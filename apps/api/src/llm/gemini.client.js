const { appConfig } = require("../config/env");

class GeminiApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "GeminiApiError";
    this.status = options.status;
    this.body = options.body;
    this.responseText = options.responseText;
    this.cause = options.cause;
    this.code = options.code;
  }
}

function normalizeApiKeys(...sources) {
  const keys = [];
  const seen = new Set();

  for (const source of sources) {
    const values = Array.isArray(source) ? source : [source];

    for (const value of values) {
      if (!value) {
        continue;
      }

      String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((apiKey) => {
          if (!seen.has(apiKey)) {
            seen.add(apiKey);
            keys.push(apiKey);
          }
        });
    }
  }

  return keys;
}

function isGeminiQuotaError(error) {
  if (!error) {
    return false;
  }

  const responseStatus = error.body?.error?.status;
  const searchableText = [
    error.message,
    error.responseText,
    error.body?.error?.message,
    responseStatus,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    error.status === 429 ||
    responseStatus === "RESOURCE_EXHAUSTED" ||
    searchableText.includes("resource_exhausted") ||
    searchableText.includes("quota") ||
    searchableText.includes("rate limit")
  );
}

class GeminiClient {
  constructor(options = {}) {
    this.apiKeys = normalizeApiKeys(
      options.apiKeys || appConfig.gemini.apiKeys,
      options.apiKey || appConfig.gemini.apiKey,
    );
    this.apiKey = this.apiKeys[0] || null;
    this.currentKeyIndex = 0;
    this.model = options.model || appConfig.gemini.model || "gemini-2.5-flash";
    this.fetchFn = options.fetchFn || globalThis.fetch;
    this.baseUrl =
      options.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
  }

  isConfigured() {
    return this.apiKeys.length > 0;
  }

  async generateText({ prompt, generationConfig = {} }) {
    const response = await this.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig,
    });

    return this.extractText(response);
  }

  async generateJson({ prompt, responseJsonSchema, temperature = 0.1 }) {
    const text = await this.generateText({
      prompt,
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
        responseJsonSchema,
      },
    });

    return JSON.parse(this.stripJsonFence(text));
  }

  async generateContent(body) {
    if (this.apiKeys.length === 0) {
      throw new Error("GEMINI_API_KEY or GEMINI_API_KEYS is not configured.");
    }

    if (typeof this.fetchFn !== "function") {
      throw new Error("Fetch API is not available in this Node runtime.");
    }

    let lastQuotaError = null;

    for (let attempt = 0; attempt < this.apiKeys.length; attempt += 1) {
      const keyIndex = (this.currentKeyIndex + attempt) % this.apiKeys.length;
      const apiKey = this.apiKeys[keyIndex];

      try {
        const responseBody = await this.requestGenerateContent(body, apiKey);
        this.currentKeyIndex = keyIndex;
        this.apiKey = apiKey;
        return responseBody;
      } catch (error) {
        if (!isGeminiQuotaError(error)) {
          throw error;
        }

        lastQuotaError = error;

        if (attempt < this.apiKeys.length - 1) {
          console.warn(
            `[GeminiClient] Gemini key #${keyIndex + 1} quota/rate-limit error, trying next key`,
          );
        }
      }
    }

    throw new GeminiApiError(
      "All Gemini API keys are quota exhausted or rate limited.",
      {
        status: lastQuotaError?.status,
        body: lastQuotaError?.body,
        responseText: lastQuotaError?.responseText,
        cause: lastQuotaError,
        code: "GEMINI_QUOTA_EXHAUSTED",
      },
    );
  }

  async requestGenerateContent(body, apiKey) {
    const endpoint = `${this.baseUrl}/models/${encodeURIComponent(
      this.normalizeModelName(this.model),
    )}:generateContent`;
    const response = await this.fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
    const responseText = await response.text();
    const responseBody = this.parseResponseBody(responseText);

    if (!response.ok) {
      throw new GeminiApiError(
        `Gemini generateContent failed with HTTP ${response.status}: ${responseText}`,
        {
          status: response.status,
          body: responseBody,
          responseText,
        },
      );
    }

    return responseBody;
  }

  parseResponseBody(responseText) {
    if (!responseText) {
      return null;
    }

    try {
      return JSON.parse(responseText);
    } catch (error) {
      throw new GeminiApiError("Gemini returned invalid JSON response.", {
        responseText,
        cause: error,
      });
    }
  }

  extractText(responseBody) {
    const parts = responseBody?.candidates?.[0]?.content?.parts || [];
    const text = parts
      .map((part) => part.text)
      .filter(Boolean)
      .join("")
      .trim();

    if (!text) {
      throw new Error("Gemini returned an empty text response.");
    }

    return text;
  }

  stripJsonFence(text) {
    return String(text || "")
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  normalizeModelName(model) {
    return String(model || "gemini-2.5-flash").replace(/^models\//, "");
  }
}

const geminiClient = new GeminiClient();

module.exports = {
  GeminiApiError,
  GeminiClient,
  isGeminiQuotaError,
  geminiClient,
  normalizeApiKeys,
};
