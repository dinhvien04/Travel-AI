const { Blob } = require("node:buffer");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline: streamPipeline } = require("node:stream/promises");

const { appConfig } = require("../config/env");

let transformersImportPromise = null;
let transformersConfigured = false;

const BGE_M3_EXTERNAL_DATA_FILE = "onnx/model.onnx_data";

class EmbeddingModelError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "EmbeddingModelError";
    this.code = "EMBEDDING_MODEL_ERROR";
    this.cause = options.cause;
    this.details = options.details;
  }
}

async function loadTransformers() {
  if (!transformersImportPromise) {
    transformersImportPromise = import("@huggingface/transformers");
  }

  const transformers = await transformersImportPromise;
  configureTransformers(transformers);

  return transformers;
}

function configureTransformers(transformers) {
  if (transformersConfigured || !transformers?.env) {
    return;
  }

  if (appConfig.embeddings.cacheDir) {
    transformers.env.cacheDir = resolveCacheDir(appConfig.embeddings.cacheDir);
  }

  transformers.env.allowRemoteModels = true;
  transformersConfigured = true;
}

function buildModelLoadOptions(options = {}) {
  const config = options.config || appConfig;
  const loadOptions = {};

  if (options.device || config.embeddings.device) {
    loadOptions.device = options.device || config.embeddings.device;
  }

  if (options.dtype || config.embeddings.dtype) {
    loadOptions.dtype = options.dtype || config.embeddings.dtype;
  }

  return loadOptions;
}

function resolveCacheDir(cacheDir = appConfig.embeddings.cacheDir) {
  return path.resolve(process.cwd(), cacheDir || "./.cache/transformers");
}

function getCachedModelFilePath(modelId, relativeFilePath, cacheDir) {
  return path.join(resolveCacheDir(cacheDir), ...modelId.split("/"), relativeFilePath);
}

function buildHuggingFaceResolveUrl(modelId, relativeFilePath, revision = "main") {
  const encodedModelId = modelId.split("/").map(encodeURIComponent).join("/");
  const encodedPath = relativeFilePath.split("/").map(encodeURIComponent).join("/");

  return `https://huggingface.co/${encodedModelId}/resolve/${encodeURIComponent(revision)}/${encodedPath}`;
}

async function ensureHuggingFaceModelFile({
  modelId,
  relativeFilePath,
  cacheDir,
  fetchFn = globalThis.fetch,
}) {
  const targetPath = getCachedModelFilePath(modelId, relativeFilePath, cacheDir);

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
    return targetPath;
  }

  if (typeof fetchFn !== "function") {
    throw new EmbeddingModelError("Fetch API is required to download model files.", {
      details: {
        model_id: modelId,
        file: relativeFilePath,
      },
    });
  }

  const downloadUrl = buildHuggingFaceResolveUrl(modelId, relativeFilePath);
  const tempPath = `${targetPath}.tmp`;

  fs.mkdirSync(path.dirname(targetPath), {
    recursive: true,
  });

  console.log(
    `[EmbeddingModelClient] downloading missing model file=${relativeFilePath} model=${modelId}`,
  );

  const response = await fetchFn(downloadUrl);

  if (!response.ok || !response.body) {
    throw new EmbeddingModelError(
      `Cannot download required model file ${relativeFilePath}.`,
      {
        details: {
          model_id: modelId,
          file: relativeFilePath,
          status: response.status,
          url: downloadUrl,
        },
      },
    );
  }

  await streamPipeline(Readable.fromWeb(response.body), fs.createWriteStream(tempPath));
  fs.renameSync(tempPath, targetPath);

  return targetPath;
}

function toNumberArray(tensor, label = "embedding tensor") {
  const data = tensor?.data || tensor;

  if (!data || typeof data.length !== "number") {
    throw new EmbeddingModelError(`${label} has no numeric data.`);
  }

  const vector = Array.from(data, (value) => Number(value));
  const invalidValue = vector.find((value) => !Number.isFinite(value));

  if (invalidValue !== undefined) {
    throw new EmbeddingModelError(`${label} contains a non-finite value.`);
  }

  return vector;
}

function normalizeVector(vector) {
  const magnitude = Math.sqrt(
    vector.reduce((sum, value) => sum + value * value, 0),
  );

  if (!magnitude) {
    throw new EmbeddingModelError("Embedding vector magnitude is zero.");
  }

  return vector.map((value) => value / magnitude);
}

function maybeNormalizeVector(vector, shouldNormalize) {
  return shouldNormalize ? normalizeVector(vector) : vector;
}

function assertExpectedDimension(vector, expectedDimension, label) {
  if (!expectedDimension) {
    return;
  }

  if (vector.length !== expectedDimension) {
    throw new EmbeddingModelError(
      `${label} dimension mismatch. Expected ${expectedDimension}, got ${vector.length}.`,
      {
        details: {
          expected_dimension: expectedDimension,
          actual_dimension: vector.length,
        },
      },
    );
  }
}

class BgeM3ModelClient {
  constructor(options = {}) {
    this.config = options.config || appConfig;
    this.modelId = options.modelId || this.config.embeddings.bgeM3Model;
    this.expectedDimension =
      options.expectedDimension || this.config.embeddings.bgeM3VectorDim;
    this.normalize = options.normalize ?? this.config.embeddings.normalize;
    this.modelLoadOptions = options.modelLoadOptions || buildModelLoadOptions(options);
    this.extractorPromise = null;
  }

  async embedText(text) {
    if (!String(text || "").trim()) {
      throw new EmbeddingModelError("Text is required for BGE-M3 embedding.");
    }

    const extractor = await this.getExtractor();
    const output = await extractor(String(text), {
      pooling: "mean",
      normalize: this.normalize,
    });
    const vector = toNumberArray(output, "BGE-M3 output");

    assertExpectedDimension(vector, this.expectedDimension, "BGE-M3 embedding");

    return vector;
  }

  async getExtractor() {
    if (!this.extractorPromise) {
      this.extractorPromise = this.loadExtractor();
    }

    return this.extractorPromise;
  }

  async loadExtractor() {
    try {
      const { pipeline } = await loadTransformers();

      console.log(`[BgeM3ModelClient] loading model=${this.modelId}`);

      await ensureHuggingFaceModelFile({
        modelId: this.modelId,
        relativeFilePath: BGE_M3_EXTERNAL_DATA_FILE,
        cacheDir: this.config.embeddings.cacheDir,
      });

      return await pipeline("feature-extraction", this.modelId, this.modelLoadOptions);
    } catch (error) {
      throw new EmbeddingModelError("Cannot load BGE-M3 embedding model.", {
        cause: error,
        details: {
          model_id: this.modelId,
        },
      });
    }
  }
}

class SiglipTextModelClient {
  constructor(options = {}) {
    this.config = options.config || appConfig;
    this.modelId = options.modelId || this.config.embeddings.siglipModel;
    this.expectedDimension =
      options.expectedDimension || this.config.embeddings.siglipTextVectorDim;
    this.normalize = options.normalize ?? this.config.embeddings.normalize;
    this.modelLoadOptions = options.modelLoadOptions || buildModelLoadOptions(options);
    this.tokenizerPromise = null;
    this.modelPromise = null;
  }

  async embedText(text) {
    if (!String(text || "").trim()) {
      throw new EmbeddingModelError("Text is required for SigLIP text embedding.");
    }

    const [tokenizer, textModel] = await Promise.all([
      this.getTokenizer(),
      this.getModel(),
    ]);
    const inputs = tokenizer([String(text)], {
      padding: "max_length",
      truncation: true,
    });
    const output = await textModel(inputs);
    const vector = maybeNormalizeVector(
      toNumberArray(output.pooler_output, "SigLIP text output"),
      this.normalize,
    );

    assertExpectedDimension(vector, this.expectedDimension, "SigLIP text embedding");

    return vector;
  }

  async getTokenizer() {
    if (!this.tokenizerPromise) {
      this.tokenizerPromise = this.loadTokenizer();
    }

    return this.tokenizerPromise;
  }

  async getModel() {
    if (!this.modelPromise) {
      this.modelPromise = this.loadModel();
    }

    return this.modelPromise;
  }

  async loadTokenizer() {
    try {
      const { AutoTokenizer } = await loadTransformers();

      console.log(`[SiglipTextModelClient] loading tokenizer=${this.modelId}`);

      return await AutoTokenizer.from_pretrained(this.modelId);
    } catch (error) {
      throw new EmbeddingModelError("Cannot load SigLIP tokenizer.", {
        cause: error,
        details: {
          model_id: this.modelId,
        },
      });
    }
  }

  async loadModel() {
    try {
      const { SiglipTextModel } = await loadTransformers();

      console.log(`[SiglipTextModelClient] loading text model=${this.modelId}`);

      return await SiglipTextModel.from_pretrained(
        this.modelId,
        this.modelLoadOptions,
      );
    } catch (error) {
      throw new EmbeddingModelError("Cannot load SigLIP text model.", {
        cause: error,
        details: {
          model_id: this.modelId,
        },
      });
    }
  }
}

class SiglipImageModelClient {
  constructor(options = {}) {
    this.config = options.config || appConfig;
    this.modelId = options.modelId || this.config.embeddings.siglipModel;
    this.expectedDimension =
      options.expectedDimension || this.config.embeddings.siglipImageVectorDim;
    this.normalize = options.normalize ?? this.config.embeddings.normalize;
    this.modelLoadOptions = options.modelLoadOptions || buildModelLoadOptions(options);
    this.processorPromise = null;
    this.modelPromise = null;
  }

  async embedImage(image) {
    if (!image?.buffer || !Buffer.isBuffer(image.buffer)) {
      throw new EmbeddingModelError("Image buffer is required for SigLIP embedding.");
    }

    const [processor, visionModel, rawImage] = await Promise.all([
      this.getProcessor(),
      this.getModel(),
      this.readRawImage(image),
    ]);
    const inputs = await processor(rawImage);
    const output = await visionModel(inputs);
    const vector = maybeNormalizeVector(
      toNumberArray(output.pooler_output, "SigLIP image output"),
      this.normalize,
    );

    assertExpectedDimension(vector, this.expectedDimension, "SigLIP image embedding");

    return vector;
  }

  async readRawImage(image) {
    try {
      const { RawImage } = await loadTransformers();
      const blob = new Blob([image.buffer], {
        type: image.mimetype || "image/jpeg",
      });

      if (typeof RawImage.fromBlob === "function") {
        return await RawImage.fromBlob(blob);
      }

      return await RawImage.read(blob);
    } catch (error) {
      throw new EmbeddingModelError("Cannot decode uploaded image for SigLIP.", {
        cause: error,
      });
    }
  }

  async getProcessor() {
    if (!this.processorPromise) {
      this.processorPromise = this.loadProcessor();
    }

    return this.processorPromise;
  }

  async getModel() {
    if (!this.modelPromise) {
      this.modelPromise = this.loadModel();
    }

    return this.modelPromise;
  }

  async loadProcessor() {
    try {
      const { AutoProcessor } = await loadTransformers();

      console.log(`[SiglipImageModelClient] loading processor=${this.modelId}`);

      return await AutoProcessor.from_pretrained(this.modelId);
    } catch (error) {
      throw new EmbeddingModelError("Cannot load SigLIP image processor.", {
        cause: error,
        details: {
          model_id: this.modelId,
        },
      });
    }
  }

  async loadModel() {
    try {
      const { SiglipVisionModel } = await loadTransformers();

      console.log(`[SiglipImageModelClient] loading vision model=${this.modelId}`);

      return await SiglipVisionModel.from_pretrained(
        this.modelId,
        this.modelLoadOptions,
      );
    } catch (error) {
      throw new EmbeddingModelError("Cannot load SigLIP vision model.", {
        cause: error,
        details: {
          model_id: this.modelId,
        },
      });
    }
  }
}

module.exports = {
  BgeM3ModelClient,
  EmbeddingModelError,
  SiglipImageModelClient,
  SiglipTextModelClient,
  assertExpectedDimension,
  buildHuggingFaceResolveUrl,
  buildModelLoadOptions,
  ensureHuggingFaceModelFile,
  getCachedModelFilePath,
  loadTransformers,
  maybeNormalizeVector,
  normalizeVector,
  resolveCacheDir,
  toNumberArray,
};
