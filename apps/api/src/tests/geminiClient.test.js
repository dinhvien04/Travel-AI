const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  GeminiApiError,
  GeminiClient,
  isGeminiQuotaError,
  normalizeApiKeys,
} = require("../llm/gemini.client");

function createFetchResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body ? JSON.stringify(body) : "";
    },
  };
}

test("normalizeApiKeys reads comma-separated and array keys", () => {
  assert.deepEqual(
    normalizeApiKeys("Key1, Key2", ["Key3", "Key2"], null),
    ["Key1", "Key2", "Key3"],
  );
});

test("isGeminiQuotaError detects Gemini resource exhausted responses", () => {
  const error = new GeminiApiError("quota exceeded", {
    status: 429,
    body: {
      error: {
        status: "RESOURCE_EXHAUSTED",
        message: "Quota exceeded",
      },
    },
  });

  assert.equal(isGeminiQuotaError(error), true);
});

test("GeminiClient rotates to next key on quota error", async () => {
  const calledKeys = [];
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(message);

  try {
    const client = new GeminiClient({
      apiKeys: "Key1,Key2",
      model: "gemini-test",
      fetchFn: async (_url, options) => {
        calledKeys.push(options.headers["x-goog-api-key"]);

        if (calledKeys.length === 1) {
          return createFetchResponse(429, {
            error: {
              status: "RESOURCE_EXHAUSTED",
              message: "Quota exceeded",
            },
          });
        }

        return createFetchResponse(200, {
          candidates: [
            {
              content: {
                parts: [{ text: "ok" }],
              },
            },
          ],
        });
      },
    });

    const text = await client.generateText({ prompt: "hello" });

    assert.equal(text, "ok");
    assert.deepEqual(calledKeys, ["Key1", "Key2"]);
    assert.equal(client.currentKeyIndex, 1);
    assert.match(warnings[0], /key #1/i);
  } finally {
    console.warn = originalWarn;
  }
});

test("GeminiClient does not rotate on invalid key error", async () => {
  const calledKeys = [];
  const client = new GeminiClient({
    apiKeys: "Key1,Key2",
    model: "gemini-test",
    fetchFn: async (_url, options) => {
      calledKeys.push(options.headers["x-goog-api-key"]);

      return createFetchResponse(400, {
        error: {
          status: "INVALID_ARGUMENT",
          message: "API key not valid",
        },
      });
    },
  });

  await assert.rejects(
    () => client.generateText({ prompt: "hello" }),
    (error) => {
      assert.equal(error instanceof GeminiApiError, true);
      assert.equal(error.status, 400);
      return true;
    },
  );
  assert.deepEqual(calledKeys, ["Key1"]);
});
