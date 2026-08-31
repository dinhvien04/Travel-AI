const { appConfig } = require("../config/env");
const { parseS3Path } = require("../utils/s3Path");
const { qdrantClient, QdrantSearchError, isQdrantError } = require("./qdrantClient");
const { buildLocationFilter } = require("./qdrantFilters");

const IMAGE_VECTOR_NAME = "image_vector";
const CAPTION_VECTOR_NAME = "caption_vector";
const HYBRID_DEFAULT_WEIGHTS = Object.freeze({
  siglip: 0.3,
  caption: 0.7,
});

function normalizeImagePayload(point = {}, options = {}) {
  const payload = point.payload || point || {};
  const parsedS3Path = parseS3Path(payload.s3_path);

  return {
    image_id: payload.image_id || null,
    title_name: payload.title_name || null,
    s3_path: payload.s3_path || null,
    s3_bucket: parsedS3Path.bucket,
    s3_key: parsedS3Path.s3_key,
    image_url: null,
    caption:
      payload.caption ||
      payload.caption_vi ||
      payload.caption_en ||
      payload.embedding_text ||
      payload.title_name ||
      null,
    caption_vi: payload.caption_vi || null,
    caption_en: payload.caption_en || null,
    location_id: payload.location_id || null,
    location_key: payload.location_key || null,
    location_name: payload.location_name || null,
    score: options.score ?? point.score ?? payload.score ?? null,
    rank: options.rank ?? payload.rank ?? null,
    source: options.source || payload.source || null,
  };
}

function getHybridKey(image, fallbackKey) {
  return image.image_id || image.s3_path || fallbackKey;
}

function mergeHybridBranch(existing, image, scoreField, source) {
  const next = existing || {
    image_id: image.image_id,
    title_name: image.title_name,
    s3_path: image.s3_path,
    s3_bucket: image.s3_bucket,
    s3_key: image.s3_key,
    image_url: image.image_url,
    caption: image.caption,
    caption_vi: image.caption_vi,
    caption_en: image.caption_en,
    location_id: image.location_id,
    location_key: image.location_key,
    location_name: image.location_name,
    siglip_score: 0,
    caption_score: 0,
    sources: [],
  };

  next[scoreField] = image.score || 0;

  if (!next.sources.includes(source)) {
    next.sources.push(source);
  }

  return next;
}

function finalizeHybridResults(items, weights, topK) {
  return items
    .map((item) => ({
      ...item,
      final_score:
        item.siglip_score * weights.siglip + item.caption_score * weights.caption,
    }))
    .sort((left, right) => right.final_score - left.final_score)
    .slice(0, topK)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
}

class ImageRepository {
  constructor(options = {}) {
    this.client = options.client || qdrantClient;
    this.collectionName = options.collectionName || appConfig.qdrant.collections.image;
    this.defaultTopK = options.defaultTopK || appConfig.retrieval.topKImages || 5;
  }

  async searchImagesByImageVector(params = {}) {
    return this.searchImages({
      vector: params.imageVector,
      vectorName: IMAGE_VECTOR_NAME,
      source: "image_vector",
      topK: params.topK,
      locationId: params.locationId,
    });
  }

  async searchImagesByCaptionVector(params = {}) {
    return this.searchImages({
      vector: params.textVector,
      vectorName: CAPTION_VECTOR_NAME,
      source: "caption_vector",
      topK: params.topK,
      locationId: params.locationId,
    });
  }

  async searchImagesBySiglipTextVector(params = {}) {
    return this.searchImages({
      vector: params.siglipTextVector,
      vectorName: IMAGE_VECTOR_NAME,
      source: "siglip_text_to_image_vector",
      topK: params.topK,
      locationId: params.locationId,
    });
  }

  async hybridSearchImagesByText(params = {}) {
    const {
      queryText,
      siglipTextVector,
      bgeTextVector,
      locationId,
      topK = this.defaultTopK,
      weights = {},
    } = params;
    const normalizedWeights = {
      siglip: weights.siglip ?? HYBRID_DEFAULT_WEIGHTS.siglip,
      caption: weights.caption ?? HYBRID_DEFAULT_WEIGHTS.caption,
    };

    console.log(
      `[ImageRepository] hybridSearchImagesByText query="${queryText || ""}" topK=${topK} locationId=${locationId || "all"} weights=${JSON.stringify(normalizedWeights)}`,
    );

    const [siglipResults, captionResults] = await Promise.all([
      this.searchImages({
        vector: siglipTextVector,
        vectorName: IMAGE_VECTOR_NAME,
        source: "siglip_text_to_image_vector",
        topK,
        locationId,
      }),
      this.searchImages({
        vector: bgeTextVector,
        vectorName: CAPTION_VECTOR_NAME,
        source: "caption_bge_m3_vector",
        topK,
        locationId,
      }),
    ]);

    const mergedByKey = new Map();

    siglipResults.forEach((image, index) => {
      const key = getHybridKey(image, `siglip-${index}`);
      mergedByKey.set(
        key,
        mergeHybridBranch(
          mergedByKey.get(key),
          image,
          "siglip_score",
          "siglip_text_to_image_vector",
        ),
      );
    });

    captionResults.forEach((image, index) => {
      const key = getHybridKey(image, `caption-${index}`);
      mergedByKey.set(
        key,
        mergeHybridBranch(
          mergedByKey.get(key),
          image,
          "caption_score",
          "caption_bge_m3_vector",
        ),
      );
    });

    return finalizeHybridResults([...mergedByKey.values()], normalizedWeights, topK);
  }

  async searchImages({ vector, vectorName, source, topK, locationId }) {
    const limit = topK || this.defaultTopK;

    console.log(
      `[ImageRepository] searchImages collection=${this.collectionName} vector=${vectorName} source=${source} topK=${limit} locationId=${locationId || "all"}`,
    );

    try {
      const points = await this.client.searchPoints({
        collectionName: this.collectionName,
        vectorName,
        vector,
        filter: buildLocationFilter(locationId),
        limit,
        withPayload: true,
        withVector: false,
      });

      return points.map((point, index) =>
        normalizeImagePayload(point, {
          rank: index + 1,
          source,
        }),
      );
    } catch (error) {
      console.log(`[ImageRepository] Qdrant error: ${error.code || error.message}`);

      if (isQdrantError(error)) {
        throw error;
      }

      throw new QdrantSearchError("Failed to search images in Qdrant.", {
        cause: error,
      });
    }
  }
}

const imageRepository = new ImageRepository();

module.exports = {
  CAPTION_VECTOR_NAME,
  HYBRID_DEFAULT_WEIGHTS,
  IMAGE_VECTOR_NAME,
  ImageRepository,
  finalizeHybridResults,
  imageRepository,
  normalizeImagePayload,
};
