const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  assertExpectedDimension,
  buildHuggingFaceResolveUrl,
  getCachedModelFilePath,
  maybeNormalizeVector,
  normalizeVector,
  resolveCacheDir,
  toNumberArray,
} = require("../embeddings/embedding.client");

test("embedding helper converts tensor data into a number array", () => {
  const vector = toNumberArray({
    data: new Float32Array([0.1, 0.2, 0.3]),
  });

  assert.equal(vector.length, 3);
  assert.equal(typeof vector[0], "number");
});

test("embedding helper normalizes vectors when configured", () => {
  const vector = maybeNormalizeVector([3, 4], true);

  assert.deepEqual(vector, [0.6, 0.8]);
  assert.deepEqual(maybeNormalizeVector([3, 4], false), [3, 4]);
  assert.deepEqual(normalizeVector([0, 2]), [0, 1]);
});

test("embedding helper rejects wrong vector dimensions", () => {
  assert.throws(
    () => assertExpectedDimension([1, 2], 3, "test embedding"),
    /dimension mismatch/i,
  );
});

test("embedding helper builds Hugging Face model file cache paths", () => {
  const cacheDir = "./.cache/transformers";
  const filePath = getCachedModelFilePath(
    "onnx-community/bge-m3-ONNX",
    "onnx/model.onnx_data",
    cacheDir,
  );

  assert.ok(filePath.includes("onnx-community"));
  assert.ok(filePath.includes("bge-m3-ONNX"));
  assert.ok(filePath.endsWith("onnx\\model.onnx_data") || filePath.endsWith("onnx/model.onnx_data"));
  assert.equal(
    buildHuggingFaceResolveUrl("onnx-community/bge-m3-ONNX", "onnx/model.onnx_data"),
    "https://huggingface.co/onnx-community/bge-m3-ONNX/resolve/main/onnx/model.onnx_data",
  );
  assert.ok(resolveCacheDir(cacheDir).endsWith(".cache\\transformers") || resolveCacheDir(cacheDir).endsWith(".cache/transformers"));
});
