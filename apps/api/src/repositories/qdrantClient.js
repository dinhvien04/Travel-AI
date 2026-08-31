const { appConfig } = require("../config/env");

const QDRANT_ERROR_CODES = Object.freeze({
  CONNECTION_ERROR: "QDRANT_CONNECTION_ERROR",
  COLLECTION_NOT_FOUND: "QDRANT_COLLECTION_NOT_FOUND",
  VECTOR_NAME_ERROR: "QDRANT_VECTOR_NAME_ERROR",
  SEARCH_ERROR: "QDRANT_SEARCH_ERROR",
});

class QdrantError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = options.name || "QdrantError";
    this.code = options.code || QDRANT_ERROR_CODES.SEARCH_ERROR;
    this.cause = options.cause;
    this.status = options.status;
    this.details = options.details;
  }
}

class QdrantConnectionError extends QdrantError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      name: "QdrantConnectionError",
      code: QDRANT_ERROR_CODES.CONNECTION_ERROR,
    });
  }
}

class QdrantCollectionNotFoundError extends QdrantError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      name: "QdrantCollectionNotFoundError",
      code: QDRANT_ERROR_CODES.COLLECTION_NOT_FOUND,
    });
  }
}

class QdrantVectorNameError extends QdrantError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      name: "QdrantVectorNameError",
      code: QDRANT_ERROR_CODES.VECTOR_NAME_ERROR,
    });
  }
}

class QdrantSearchError extends QdrantError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      name: "QdrantSearchError",
      code: QDRANT_ERROR_CODES.SEARCH_ERROR,
    });
  }
}

function isQdrantError(error) {
  return error instanceof QdrantError || Boolean(error?.code?.startsWith("QDRANT_"));
}

function getErrorText(body) {
  if (!body) {
    return "";
  }

  if (typeof body === "string") {
    return body;
  }

  return JSON.stringify(body);
}

function classifyQdrantResponseError({ status, body, collectionName, vectorName }) {
  const errorText = getErrorText(body);
  const details = {
    collection_name: collectionName,
    vector_name: vectorName,
    qdrant_response: body,
  };

  if (status === 404) {
    return new QdrantCollectionNotFoundError(
      `Qdrant collection not found: ${collectionName}`,
      {
        status,
        details,
      },
    );
  }

  if (status === 400 && vectorName && /vector|named|using/i.test(errorText)) {
    return new QdrantVectorNameError(
      `Qdrant vector name error for vector: ${vectorName}`,
      {
        status,
        details,
      },
    );
  }

  return new QdrantSearchError(`Qdrant search request failed with HTTP ${status}.`, {
    status,
    details,
  });
}

async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return text;
  }
}

function assertVector(vector, label) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new QdrantSearchError(`${label} must be a non-empty number array.`);
  }

  const invalidValue = vector.find((value) => typeof value !== "number");
  if (invalidValue !== undefined) {
    throw new QdrantSearchError(`${label} contains a non-number value.`);
  }
}

function buildQdrantUrl(baseUrl, path) {
  const normalizedBaseUrl = String(baseUrl || "").replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}

class QdrantClient {
  constructor(options = {}) {
    this.url = options.url || appConfig.qdrant.url;
    this.apiKey = options.apiKey || appConfig.qdrant.apiKey;
    this.fetchFn = options.fetchFn || globalThis.fetch;
  }

  async listCollections() {
    if (!this.url) {
      throw new QdrantConnectionError("QDRANT_URL is not configured.");
    }

    if (typeof this.fetchFn !== "function") {
      throw new QdrantConnectionError("Fetch API is not available in this Node runtime.");
    }

    const endpoint = buildQdrantUrl(this.url, "/collections");
    const headers = {
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers["api-key"] = this.apiKey;
    }

    let response;

    try {
      response = await this.fetchFn(endpoint, {
        method: "GET",
        headers,
      });
    } catch (error) {
      throw new QdrantConnectionError("Cannot connect to Qdrant.", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new QdrantConnectionError(`Qdrant returned HTTP ${response.status}.`, {
        status: response.status,
      });
    }

    const body = await response.json();
    return body?.result?.collections || [];
  }

  async searchPoints({
    collectionName,
    vectorName,
    vector,
    filter,
    limit = 5,
    withPayload = true,
    withVector = false,
  }) {
    assertVector(vector, "query vector");

    const body = {
      vector: {
        name: vectorName,
        vector,
      },
      limit,
      with_payload: withPayload,
      with_vector: withVector,
    };

    if (filter) {
      body.filter = filter;
    }

    const result = await this.request(
      `/collections/${encodeURIComponent(collectionName)}/points/search`,
      {
        method: "POST",
        body,
        collectionName,
        vectorName,
      },
    );

    return Array.isArray(result?.result) ? result.result : [];
  }

  async scrollPoints({
    collectionName,
    filter,
    limit = 10,
    withPayload = true,
    withVector = false,
  }) {
    const body = {
      limit,
      with_payload: withPayload,
      with_vector: withVector,
    };

    if (filter) {
      body.filter = filter;
    }

    const result = await this.request(
      `/collections/${encodeURIComponent(collectionName)}/points/scroll`,
      {
        method: "POST",
        body,
        collectionName,
      },
    );

    return result?.result?.points || [];
  }

  async request(path, options = {}) {
    if (!this.url) {
      throw new QdrantConnectionError("QDRANT_URL is not configured.");
    }

    if (typeof this.fetchFn !== "function") {
      throw new QdrantConnectionError("Fetch API is not available in this Node runtime.");
    }

    const endpoint = buildQdrantUrl(this.url, path);
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["api-key"] = this.apiKey;
    }

    let response;

    try {
      response = await this.fetchFn(endpoint, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (error) {
      throw new QdrantConnectionError("Cannot connect to Qdrant.", {
        cause: error,
      });
    }

    const body = await readJsonResponse(response);

    if (!response.ok) {
      throw classifyQdrantResponseError({
        status: response.status,
        body,
        collectionName: options.collectionName,
        vectorName: options.vectorName,
      });
    }

    return body;
  }
}

const qdrantClient = new QdrantClient();

module.exports = {
  QDRANT_ERROR_CODES,
  QdrantClient,
  QdrantError,
  QdrantConnectionError,
  QdrantCollectionNotFoundError,
  QdrantSearchError,
  QdrantVectorNameError,
  assertVector,
  buildQdrantUrl,
  isQdrantError,
  qdrantClient,
};
