const { appConfig } = require("../config/env");
const { qdrantClient, QdrantSearchError, isQdrantError } = require("./qdrantClient");
const { buildLocationFilter } = require("./qdrantFilters");
const { normalizeText } = require("../utils/text");

function normalizeLocationPayload(payload = {}) {
  return {
    location_id: payload.location_id || null,
    location_key: payload.location_key || null,
    location_name: payload.location_name || null,
    province: payload.province || null,
    description: payload.description || null,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
  };
}

class LocationRepository {
  constructor(options = {}) {
    this.client = options.client || qdrantClient;
    this.collectionName =
      options.collectionName || appConfig.qdrant.collections.location;
  }

  async getLocationById(locationId) {
    if (!locationId) {
      return null;
    }

    console.log(`[LocationRepository] getLocationById location_id=${locationId}`);

    try {
      const points = await this.client.scrollPoints({
        collectionName: this.collectionName,
        filter: buildLocationFilter(locationId),
        limit: 1,
        withPayload: true,
        withVector: false,
      });

      const point = points[0];
      if (!point) {
        console.log(`[LocationRepository] location_id=${locationId} not found`);
        return null;
      }

      return normalizeLocationPayload(point.payload);
    } catch (error) {
      console.log(`[LocationRepository] Qdrant error: ${error.code || error.message}`);

      if (isQdrantError(error)) {
        throw error;
      }

      throw new QdrantSearchError("Failed to read location metadata from Qdrant.", {
        cause: error,
      });
    }
  }

  async findLocationByName(locationName, options = {}) {
    if (!locationName) {
      return null;
    }

    const normalizedQuery = normalizeText(locationName);
    const limit = options.limit || 200;

    console.log(`[LocationRepository] findLocationByName name=${locationName}`);

    try {
      const points = await this.client.scrollPoints({
        collectionName: this.collectionName,
        limit,
        withPayload: true,
        withVector: false,
      });
      const matchedPoint = points.find((point) => {
        const payload = point.payload || {};
        const names = [
          payload.location_name,
          payload.location_key,
          payload.title_name,
        ].filter(Boolean);

        return names.some((name) => {
          const normalizedName = normalizeText(name);

          return (
            normalizedName === normalizedQuery ||
            normalizedName.includes(normalizedQuery) ||
            normalizedQuery.includes(normalizedName)
          );
        });
      });

      if (!matchedPoint) {
        console.log(`[LocationRepository] location name=${locationName} not found`);
        return null;
      }

      return normalizeLocationPayload(matchedPoint.payload);
    } catch (error) {
      console.log(`[LocationRepository] Qdrant error: ${error.code || error.message}`);

      if (isQdrantError(error)) {
        throw error;
      }

      throw new QdrantSearchError("Failed to find location metadata by name.", {
        cause: error,
      });
    }
  }
}

const locationRepository = new LocationRepository();

module.exports = {
  LocationRepository,
  locationRepository,
  normalizeLocationPayload,
};
