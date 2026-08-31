const { appConfig } = require("../config/env");
const {
  QdrantConnectionError,
  qdrantClient,
} = require("../repositories/qdrantClient");

const QDRANT_ERROR_CODES = Object.freeze({
  CONNECTION_ERROR: "QDRANT_CONNECTION_ERROR",
  COLLECTION_NOT_FOUND: "QDRANT_COLLECTION_NOT_FOUND",
});

function getRequiredCollections(config) {
  return [
    config.qdrant.collections.location,
    config.qdrant.collections.image,
    config.qdrant.collections.text,
  ];
}

function normalizeCollectionNames(collections) {
  return collections
    .map((collection) => {
      if (typeof collection === "string") {
        return collection;
      }

      return collection?.name;
    })
    .filter(Boolean);
}

class QdrantHealthService {
  constructor(options = {}) {
    this.client = options.client || qdrantClient;
    this.config = options.config || appConfig;
  }

  async check() {
    const requiredCollections = getRequiredCollections(this.config);

    try {
      const collections = await this.client.listCollections();
      const availableCollections = normalizeCollectionNames(collections);
      const missingCollections = requiredCollections.filter(
        (collectionName) => !availableCollections.includes(collectionName),
      );

      if (missingCollections.length > 0) {
        return {
          success: false,
          error_code: QDRANT_ERROR_CODES.COLLECTION_NOT_FOUND,
          message: "Qdrant is connected but one or more required collections are missing.",
          data: {
            required_collections: requiredCollections,
            available_collections: availableCollections,
            missing_collections: missingCollections,
          },
        };
      }

      return {
        success: true,
        error_code: null,
        message: "Qdrant connection is healthy.",
        data: {
          qdrant_url: this.config.qdrant.url || null,
          required_collections: requiredCollections,
          available_collections: availableCollections,
        },
      };
    } catch (error) {
      const status = error instanceof QdrantConnectionError ? error.status : undefined;

      return {
        success: false,
        error_code: QDRANT_ERROR_CODES.CONNECTION_ERROR,
        message: "Cannot connect to Qdrant external service.",
        data: {
          qdrant_url: this.config.qdrant.url || null,
          status: status || null,
          reason: error.message,
        },
      };
    }
  }
}

const qdrantHealthService = new QdrantHealthService();

module.exports = {
  QDRANT_ERROR_CODES,
  QdrantHealthService,
  getRequiredCollections,
  normalizeCollectionNames,
  qdrantHealthService,
};
