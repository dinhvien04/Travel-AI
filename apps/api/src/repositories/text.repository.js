const { appConfig } = require("../config/env");
const { qdrantClient, QdrantSearchError, isQdrantError } = require("./qdrantClient");
const { buildLocationFilter } = require("./qdrantFilters");

const TEXT_VECTOR_NAME = "text_vector";

function normalizeDocumentPoint(point, index) {
  const payload = point?.payload || {};

  return {
    chunk_id: payload.chunk_id || null,
    section_id: payload.section_id || null,
    location_id: payload.location_id || null,
    location_key: payload.location_key || null,
    document_type: payload.document_type || null,
    source_file: payload.source_file || null,
    s3_path: payload.s3_path || null,
    section_number: payload.section_number || null,
    section_title: payload.section_title || null,
    chunk_index: payload.chunk_index ?? null,
    total_chunks: payload.total_chunks ?? null,
    content: payload.content || null,
    score: point?.score ?? null,
    rank: index + 1,
  };
}

class TextRepository {
  constructor(options = {}) {
    this.client = options.client || qdrantClient;
    this.collectionName = options.collectionName || appConfig.qdrant.collections.text;
    this.defaultTopK = options.defaultTopK || appConfig.retrieval.topKDocs || 5;
  }

  async searchDocsByTextVector(params = {}) {
    const { textVector, locationId, topK = this.defaultTopK } = params;

    console.log(
      `[TextRepository] searchDocsByTextVector collection=${this.collectionName} vector=${TEXT_VECTOR_NAME} topK=${topK} locationId=${locationId || "all"}`,
    );

    try {
      const points = await this.client.searchPoints({
        collectionName: this.collectionName,
        vectorName: TEXT_VECTOR_NAME,
        vector: textVector,
        filter: buildLocationFilter(locationId),
        limit: topK,
        withPayload: true,
        withVector: false,
      });

      return points.map(normalizeDocumentPoint);
    } catch (error) {
      console.log(`[TextRepository] Qdrant error: ${error.code || error.message}`);

      if (isQdrantError(error)) {
        throw error;
      }

      throw new QdrantSearchError("Failed to search document chunks in Qdrant.", {
        cause: error,
      });
    }
  }
}

const textRepository = new TextRepository();

module.exports = {
  TEXT_VECTOR_NAME,
  TextRepository,
  normalizeDocumentPoint,
  textRepository,
};
