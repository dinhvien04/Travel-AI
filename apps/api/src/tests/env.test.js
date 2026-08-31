const assert = require("node:assert/strict");
const { test } = require("node:test");

const { appConfig } = require("../config/env");

test("env config uses actual Qdrant collection names", () => {
  assert.equal(appConfig.qdrant.collections.location, "location_info");
  assert.equal(appConfig.qdrant.collections.image, "image_collection");
  assert.equal(appConfig.qdrant.collections.text, "text_collection");
});

test("env config keeps S3 URL mode constrained", () => {
  assert.match(appConfig.s3.urlMode, /^(presigned|public)$/);
});

test("env config points embedding services to real model ids", () => {
  assert.equal(appConfig.embeddings.bgeM3Model, "onnx-community/bge-m3-ONNX");
  assert.equal(appConfig.embeddings.siglipModel, "Xenova/siglip-base-patch16-384");
  assert.equal(appConfig.embeddings.bgeM3VectorDim, 1024);
  assert.equal(appConfig.embeddings.siglipImageVectorDim, 768);
  assert.equal(appConfig.embeddings.siglipTextVectorDim, 768);
});
