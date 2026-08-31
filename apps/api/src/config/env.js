const dotenv = require("dotenv");

dotenv.config();

function numberFromEnv(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function enumFromEnv(value, allowedValues, fallback) {
  if (!value) {
    return fallback;
  }

  const normalized = value.toLowerCase();
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function listFromEnv(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function booleanFromEnv(value, fallback) {
  if (!value) {
    return fallback;
  }

  const normalized = String(value).toLowerCase();

  if (["1", "true", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n"].includes(normalized)) {
    return false;
  }

  return fallback;
}

const s3UrlModes = ["presigned", "public"];

const appConfig = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: numberFromEnv(process.env.APP_PORT || process.env.PORT, 8000),
  apiPrefix: process.env.API_PREFIX || "/api",
  qdrant: {
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    collections: {
      location: process.env.QDRANT_LOCATION_COLLECTION || "location_info",
      image: process.env.QDRANT_IMAGE_COLLECTION || "image_collection",
      text: process.env.QDRANT_TEXT_COLLECTION || "text_collection",
    },
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    apiKeys: listFromEnv(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL,
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  },
  s3: {
    presignedExpiresIn: numberFromEnv(process.env.S3_PRESIGNED_EXPIRES_IN, 900),
    urlMode: enumFromEnv(process.env.S3_URL_MODE, s3UrlModes, "public"),
  },
  retrieval: {
    topKDocs: numberFromEnv(process.env.TOP_K_DOCS, 5),
    topKImages: numberFromEnv(process.env.TOP_K_IMAGES, 5),
    imageMatchThreshold: numberFromEnv(process.env.IMAGE_MATCH_THRESHOLD, 0.75),
    imageLowConfidenceThreshold: numberFromEnv(
      process.env.IMAGE_LOW_CONFIDENCE_THRESHOLD,
      0.25,
    ),
  },
  embeddings: {
    bgeM3Model: process.env.BGE_M3_MODEL || "onnx-community/bge-m3-ONNX",
    siglipModel: process.env.SIGLIP_MODEL || "Xenova/siglip-base-patch16-384",
    bgeM3VectorDim: numberFromEnv(process.env.BGE_M3_VECTOR_DIM, 1024),
    siglipImageVectorDim: numberFromEnv(process.env.SIGLIP_IMAGE_VECTOR_DIM, 768),
    siglipTextVectorDim: numberFromEnv(process.env.SIGLIP_TEXT_VECTOR_DIM, 768),
    normalize: booleanFromEnv(process.env.EMBEDDING_NORMALIZE, true),
    cacheDir: process.env.TRANSFORMERS_CACHE_DIR || "./.cache/transformers",
    device: process.env.TRANSFORMERS_DEVICE || "cpu",
    dtype: process.env.TRANSFORMERS_DTYPE || undefined,
  },
};

module.exports = {
  appConfig,
  booleanFromEnv,
  listFromEnv,
  s3UrlModes,
};
