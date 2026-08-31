const { parseS3Path } = require("./s3Path");

const RESPONSE_STATUS = Object.freeze({
  OK: "ok",
  ERROR: "error",
  OUT_OF_SCOPE: "out_of_scope",
  NEED_CLARIFICATION: "need_clarification",
  LOW_CONFIDENCE: "low_confidence",
});

const ERROR_CODES = Object.freeze({
  INTERNAL_ERROR: "INTERNAL_ERROR",
  EMPTY_INPUT: "EMPTY_INPUT",
  EMBEDDING_MODEL_ERROR: "EMBEDDING_MODEL_ERROR",
  LLM_CLASSIFICATION_ERROR: "LLM_CLASSIFICATION_ERROR",
  MISSING_LOCATION_CONTEXT: "MISSING_LOCATION_CONTEXT",
  PIPELINE_NOT_IMPLEMENTED: "PIPELINE_NOT_IMPLEMENTED",
  QDRANT_CONNECTION_ERROR: "QDRANT_CONNECTION_ERROR",
  QDRANT_COLLECTION_NOT_FOUND: "QDRANT_COLLECTION_NOT_FOUND",
  QDRANT_SEARCH_ERROR: "QDRANT_SEARCH_ERROR",
  QDRANT_VECTOR_NAME_ERROR: "QDRANT_VECTOR_NAME_ERROR",
  IMAGE_NOT_TRAVEL_RELATED: "IMAGE_NOT_TRAVEL_RELATED",
  IMAGE_LOCATION_NOT_FOUND: "IMAGE_LOCATION_NOT_FOUND",
  TEXT_NOT_TRAVEL_RELATED: "TEXT_NOT_TRAVEL_RELATED",
  OUT_OF_SCOPE: "OUT_OF_SCOPE",
  NEED_CLARIFICATION: "NEED_CLARIFICATION",
  LOW_CONFIDENCE: "LOW_CONFIDENCE",
  LOW_CONFIDENCE_MATCH: "LOW_CONFIDENCE_MATCH",
});

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {string} status
 * @property {string|null} error_code
 * @property {string} message
 * @property {*|null} data
 * @property {string[]} suggested_questions
 */

function normalizeSuggestedQuestions(suggestedQuestions) {
  return Array.isArray(suggestedQuestions) ? suggestedQuestions : [];
}

function createResponse({
  success,
  status,
  errorCode = null,
  message = "",
  data = null,
  suggestedQuestions = [],
}) {
  return {
    success,
    status,
    error_code: errorCode,
    message,
    data,
    suggested_questions: normalizeSuggestedQuestions(suggestedQuestions),
  };
}

function okResponse(data = null, options = {}) {
  return createResponse({
    success: true,
    status: RESPONSE_STATUS.OK,
    errorCode: null,
    message: Object.hasOwn(options, "message") ? options.message : "OK",
    data,
    suggestedQuestions: options.suggestedQuestions,
  });
}

function errorResponse(
  errorCode = ERROR_CODES.INTERNAL_ERROR,
  message = "Internal server error.",
  options = {},
) {
  return createResponse({
    success: false,
    status: RESPONSE_STATUS.ERROR,
    errorCode,
    message,
    data: options.data || null,
    suggestedQuestions: options.suggestedQuestions,
  });
}

function outOfScopeResponse(options = {}) {
  return createResponse({
    success: false,
    status: RESPONSE_STATUS.OUT_OF_SCOPE,
    errorCode: options.errorCode || ERROR_CODES.OUT_OF_SCOPE,
    message:
      options.message ||
      "This request is outside the supported travel assistant scope.",
    data: options.data || null,
    suggestedQuestions: options.suggestedQuestions,
  });
}

function needClarificationResponse(options = {}) {
  return createResponse({
    success: false,
    status: RESPONSE_STATUS.NEED_CLARIFICATION,
    errorCode: options.errorCode || ERROR_CODES.NEED_CLARIFICATION,
    message: options.message || "Please clarify your travel request.",
    data: options.data || null,
    suggestedQuestions: options.suggestedQuestions,
  });
}

function lowConfidenceResponse(options = {}) {
  return createResponse({
    success: false,
    status: RESPONSE_STATUS.LOW_CONFIDENCE,
    errorCode: options.errorCode || ERROR_CODES.LOW_CONFIDENCE,
    message:
      options.message ||
      "The assistant could not find a confident travel answer.",
    data: options.data || null,
    suggestedQuestions: options.suggestedQuestions,
  });
}

function formatImageResponseItem(payload = {}, options = {}) {
  const s3Path = payload.s3_path || options.s3Path || null;
  const parsedS3Path = parseS3Path(s3Path);

  return {
    image_id: payload.image_id || options.imageId || null,
    title_name: payload.title_name || null,
    image_url: payload.image_url || options.imageUrl || null,
    s3_path: s3Path,
    s3_bucket: parsedS3Path.bucket,
    s3_key: parsedS3Path.s3_key,
    caption: payload.caption || null,
    caption_vi: payload.caption_vi || null,
    caption_en: payload.caption_en || null,
    location_id: payload.location_id || null,
    location_key: payload.location_key || null,
    location_name: payload.location_name || null,
    final_score: options.finalScore ?? payload.final_score ?? payload.score ?? null,
    rank: options.rank ?? payload.rank ?? null,
  };
}

module.exports = {
  RESPONSE_STATUS,
  ERROR_CODES,
  okResponse,
  errorResponse,
  outOfScopeResponse,
  needClarificationResponse,
  lowConfidenceResponse,
  formatImageResponseItem,
};
