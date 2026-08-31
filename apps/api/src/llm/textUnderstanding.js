const { geminiClient } = require("./gemini.client");
const { normalizeText } = require("../utils/text");

const TEXT_UNDERSTANDING_REQUIRED_FIELDS = [
  "rewrite_query",
  "need_docs",
  "need_images",
  "need_metadata",
  "location_id",
  "location_name",
  "is_follow_up",
  "intent",
];

const TEXT_UNDERSTANDING_INTENTS = [
  "overview",
  "activity",
  "image_search",
  "metadata",
  "location_lookup",
  "unknown",
];

const TEXT_UNDERSTANDING_SCHEMA = {
  type: "object",
  properties: {
    rewrite_query: { type: "string" },
    need_docs: { type: "boolean" },
    need_images: { type: "boolean" },
    need_metadata: { type: "boolean" },
    location_id: { type: "string", nullable: true },
    location_name: { type: "string", nullable: true },
    is_follow_up: { type: "boolean" },
    intent: {
      type: "string",
      enum: TEXT_UNDERSTANDING_INTENTS,
    },
  },
  required: TEXT_UNDERSTANDING_REQUIRED_FIELDS,
};

const KNOWN_LOCATIONS = [
  { keyword: "quy hoa", location_name: "Bien Quy Hoa", location_id: null },
  { keyword: "ky co", location_name: "Ky Co", location_id: null },
  { keyword: "eo gio", location_name: "Eo Gio", location_id: null },
  { keyword: "hon kho", location_name: "Hon Kho", location_id: "LOC_012" },
  { keyword: "ghe nh rang", location_name: "Ghenh Rang", location_id: null },
  { keyword: "thap doi", location_name: "Thap Doi", location_id: null },
];

class LlmClassificationError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "LlmClassificationError";
    this.code = "LLM_CLASSIFICATION_ERROR";
    this.details = options.details;
    this.cause = options.cause;
  }
}

function detectLocation(message) {
  const normalized = normalizeText(message);
  return KNOWN_LOCATIONS.find((location) => normalized.includes(location.keyword)) || null;
}

function isImageIntent(normalizedMessage) {
  return (
    normalizedMessage.includes("anh") ||
    normalizedMessage.includes("hinh") ||
    normalizedMessage.includes("xem anh") ||
    normalizedMessage.includes("xem hinh")
  );
}

function isActivityIntent(normalizedMessage) {
  return (
    normalizedMessage.includes("choi") ||
    normalizedMessage.includes("lam gi") ||
    normalizedMessage.includes("co gi")
  );
}

function isLocationLookupIntent(normalizedMessage) {
  return normalizedMessage.includes("o dau") || normalizedMessage.includes("dia chi");
}

function assertNullableString(value, fieldName) {
  if (value !== null && typeof value !== "string") {
    throw new LlmClassificationError(`${fieldName} must be string or null.`, {
      details: { field: fieldName, value },
    });
  }
}

function assertBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw new LlmClassificationError(`${fieldName} must be boolean.`, {
      details: { field: fieldName, value },
    });
  }
}

class TextUnderstandingService {
  constructor(options = {}) {
    this.geminiClient = options.geminiClient || geminiClient;
    this.useFallbackWhenNotConfigured = options.useFallbackWhenNotConfigured ?? false;
  }

  async understand({ message, context = {} }) {
    if (this.geminiClient.isConfigured?.()) {
      console.log("[TextUnderstanding] Using Gemini LLM for text understanding");
      return this.understandWithLlm({ message, context });
    }

    if (this.useFallbackWhenNotConfigured) {
      console.log(
        "[TextUnderstanding] GEMINI_API_KEY/GEMINI_API_KEYS missing, using fallback heuristic",
      );
      return this.understandWithFallback({ message, context });
    }

    throw new LlmClassificationError(
      "GEMINI_API_KEY or GEMINI_API_KEYS is not configured.",
    );
  }


  async understandWithLlm({ message, context }) {
    try {
      const result = await this.geminiClient.generateJson({
        prompt: this.buildPrompt({ message, context }),
        responseJsonSchema: TEXT_UNDERSTANDING_SCHEMA,
        temperature: 0.1,
      });

      return this.validateLlmResult(result);
    } catch (error) {
      if (error instanceof LlmClassificationError) {
        throw error;
      }

      throw new LlmClassificationError("Gemini text understanding returned invalid JSON.", {
        cause: error,
      });
    }
  }

  buildPrompt({ message, context = {} }) {
    const compactContext = {
      old_input: context.old_input || null,
      old_rewrite_query: context.old_rewrite_query || null,
      active_location_id: context.active_location_id || null,
      active_location_name: context.active_location_name || null,
      last_returned_images: (context.last_returned_images || [])
        .slice(0, 5)
        .map((image) => ({
          image_id: image.image_id || null,
          rank: image.rank || null,
          location_id: image.location_id || null,
          location_name: image.location_name || null,
          caption: image.caption || image.caption_vi || image.caption_en || null,
        })),
    };

    return [
      "Ban la Text Understanding module cho Travel AI Assistant ve du lich Viet Nam.",
      "Hay phan tich user message va conversation context, sau do tra ve DUY NHAT mot JSON object dung schema.",
      "",
      "Bat buoc tra cac field:",
      TEXT_UNDERSTANDING_REQUIRED_FIELDS.join(", "),
      "",
      "Quy tac:",
      "- Cau hoi thong tin, hoat dong, vi tri dia diem: need_docs=true, need_images=false, need_metadata=true.",
      "- Cau hoi xem/tim anh: need_images=true, need_docs=false, need_metadata=true, intent=image_search.",
      "- Cau hoi follow-up nhu 'o do', 'cho nay', 'dia diem nay', 'anh thu hai': dung context active_location_id/name hoac last_returned_images neu co.",
      "- rewrite_query phai ro nghia, uu tien them ten dia diem neu biet.",
      "- Neu khong biet location_id thi tra null. Khong tu bia ma location_id.",
      "- Khong tra markdown, khong giai thich, khong them field ngoai schema.",
      "",
      `Intent hop le: ${TEXT_UNDERSTANDING_INTENTS.join(", ")}.`,
      "",
      `Conversation context JSON:\n${JSON.stringify(compactContext, null, 2)}`,
      "",
      `User message: ${message}`,
    ].join("\n");
  }

  validateLlmResult(result) {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new LlmClassificationError("Gemini output must be a JSON object.", {
        details: { result },
      });
    }

    for (const field of TEXT_UNDERSTANDING_REQUIRED_FIELDS) {
      if (!Object.hasOwn(result, field)) {
        throw new LlmClassificationError(`Gemini output missing field: ${field}`, {
          details: { result },
        });
      }
    }

    if (typeof result.rewrite_query !== "string" || !result.rewrite_query.trim()) {
      throw new LlmClassificationError("rewrite_query must be a non-empty string.", {
        details: { value: result.rewrite_query },
      });
    }

    assertBoolean(result.need_docs, "need_docs");
    assertBoolean(result.need_images, "need_images");
    assertBoolean(result.need_metadata, "need_metadata");
    assertBoolean(result.is_follow_up, "is_follow_up");
    assertNullableString(result.location_id, "location_id");
    assertNullableString(result.location_name, "location_name");

    if (!TEXT_UNDERSTANDING_INTENTS.includes(result.intent)) {
      throw new LlmClassificationError("intent is not valid.", {
        details: { value: result.intent },
      });
    }

    return {
      rewrite_query: result.rewrite_query.trim(),
      need_docs: result.need_docs,
      need_images: result.need_images,
      need_metadata: result.need_metadata,
      location_id: result.location_id || null,
      location_name: result.location_name || null,
      is_follow_up: result.is_follow_up,
      intent: result.intent,
    };
  }

  understandWithFallback({ message, context = {} }) {
    const normalized = normalizeText(message);
    const detectedLocation = detectLocation(message);
    const hasImageIntent = isImageIntent(normalized);
    const isFollowUp = this.isFollowUp(normalized, context);
    const locationName =
      detectedLocation?.location_name ||
      (isFollowUp ? context.active_location_name : null);
    const locationId =
      detectedLocation?.location_id || (isFollowUp ? context.active_location_id : null);
    const intent = this.detectIntent(normalized, hasImageIntent);

    return {
      rewrite_query: this.buildRewriteQuery({
        message,
        normalized,
        locationName,
        intent,
        isFollowUp,
      }),
      need_docs: !hasImageIntent,
      need_images: hasImageIntent,
      need_metadata: true,
      location_id: locationId || null,
      location_name: locationName || null,
      is_follow_up: isFollowUp,
      intent,
    };
  }

  detectIntent(normalizedMessage, hasImageIntent) {
    if (hasImageIntent) {
      return "image_search";
    }

    if (isLocationLookupIntent(normalizedMessage)) {
      return "location_lookup";
    }

    if (isActivityIntent(normalizedMessage)) {
      return "activity";
    }

    return "overview";
  }

  isFollowUp(normalizedMessage, context) {
    const hasContext = Boolean(context.active_location_id || context.active_location_name);

    return (
      hasContext &&
      (normalizedMessage.includes("o do") ||
        normalizedMessage.includes("cho nay") ||
        normalizedMessage.includes("noi nay") ||
        normalizedMessage.includes("dia diem nay") ||
        normalizedMessage.includes("anh thu") ||
        normalizedMessage.includes("anh nay"))
    );
  }

  buildRewriteQuery({ message, normalized, locationName, intent, isFollowUp }) {
    if (intent === "image_search") {
      return locationName ? `Anh dep ve ${locationName}` : message;
    }

    if (!isFollowUp || !locationName) {
      return message;
    }

    if (normalized.includes("choi") || normalized.includes("co gi")) {
      return `${locationName} co gi choi?`;
    }

    if (normalized.includes("dep")) {
      return `${locationName} dep khong?`;
    }

    if (normalized.includes("o dau")) {
      return `${locationName} o dau?`;
    }

    return `${locationName}: ${message}`;
  }
}

const textUnderstandingService = new TextUnderstandingService();

module.exports = {
  KNOWN_LOCATIONS,
  LlmClassificationError,
  TEXT_UNDERSTANDING_SCHEMA,
  TextUnderstandingService,
  detectLocation,
  textUnderstandingService,
};
