const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  QdrantHealthService,
  normalizeCollectionNames,
} = require("../services/qdrantHealthService");
const { QdrantConnectionError, buildQdrantUrl } = require("../repositories/qdrantClient");

const testConfig = {
  qdrant: {
    url: "https://qdrant.example.com",
    collections: {
      location: "location_info",
      image: "image_collection",
      text: "text_collection",
    },
  },
};

test("buildQdrantUrl appends /collections to external base URL", () => {
  assert.equal(
    buildQdrantUrl("https://qdrant.example.com/", "/collections"),
    "https://qdrant.example.com/collections",
  );
});

test("normalizeCollectionNames supports Qdrant collection objects", () => {
  assert.deepEqual(
    normalizeCollectionNames([{ name: "location_info" }, { name: "text_collection" }]),
    ["location_info", "text_collection"],
  );
});

test("qdrant health passes when all required collections exist", async () => {
  const service = new QdrantHealthService({
    config: testConfig,
    client: {
      async listCollections() {
        return [
          { name: "location_info" },
          { name: "image_collection" },
          { name: "text_collection" },
        ];
      },
    },
  });

  const result = await service.check();

  assert.equal(result.success, true);
  assert.equal(result.error_code, null);
});

test("qdrant health fails when a required collection is missing", async () => {
  const service = new QdrantHealthService({
    config: testConfig,
    client: {
      async listCollections() {
        return [{ name: "location_info" }, { name: "text_collection" }];
      },
    },
  });

  const result = await service.check();

  assert.equal(result.success, false);
  assert.equal(result.error_code, "QDRANT_COLLECTION_NOT_FOUND");
  assert.deepEqual(result.data.missing_collections, ["image_collection"]);
});

test("qdrant health fails when Qdrant cannot be reached", async () => {
  const service = new QdrantHealthService({
    config: testConfig,
    client: {
      async listCollections() {
        throw new QdrantConnectionError("Cannot connect to Qdrant.");
      },
    },
  });

  const result = await service.check();

  assert.equal(result.success, false);
  assert.equal(result.error_code, "QDRANT_CONNECTION_ERROR");
});
