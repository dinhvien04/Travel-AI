const { geminiClient } = require("./gemini.client");
const {
  KNOWN_LOCATIONS,
  LlmClassificationError,
  detectLocation,
} = require("./textUnderstanding");
const { normalizeText } = require("../utils/text");

const IMAGE_TEXT_UNDERSTANDING_REQUIRED_FIELDS = [
  "rewrite_query",
  "need_docs",
  "need_images",
  "need_metadata",
  "image_place_id",
  "image_place_name",
  "text_place_id",
  "text_place_name",
  "final_place_id",
  "final_place_name",
  "is_reference_question",
  "is_specific_place_question",
  "intent",
];

const IMAGE_TEXT_UNDERSTANDING_INTENTS = [
  "overview",
  "activity",
  "image_search",
  "metadata",
  "location_lookup",
  "comparison",
  "unknown",
];

const IMAGE_TEXT_UNDERSTANDING_SCHEMA = {
  type: "object",
  properties: {
    rewrite_query: { type: "string" },
    need_docs: { type: "boolean" },
    need_images: { type: "boolean" },
    need_metadata: { type: "boolean" },
    image_place_id: { type: "string", nullable: true },
    image_place_name: { type: "string", nullable: true },
    text_place_id: { type: "string", nullable: true },
    text_place_name: { type: "string", nullable: true },
    final_place_id: { type: "string", nullable: true },
    final_place_name: { type: "string", nullable: true },
    is_reference_question: { type: "boolean" },
    is_specific_place_question: { type: "boolean" },
    intent: {
      type: "string",
      enum: IMAGE_TEXT_UNDERSTANDING_INTENTS,
    },
  },
  required: IMAGE_TEXT_UNDERSTANDING_REQUIRED_FIELDS,
};

function assertBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw new LlmClassificationError(`${fieldName} must be boolean.`, {
      details: { field: fieldName, value },
    });
  }
}

function assertNullableString(value, fieldName) {
  if (value !== null && typeof value !== "string") {
    throw new LlmClassificationError(`${fieldName} must be string or null.`, {
      details: { field: fieldName, value },
    });
  }
}

function isReferenceQuestion(normalizedMessage) {
  return (
    normalizedMessage.includes("o day") ||
    normalizedMessage.includes("o do") ||
    normalizedMessage.includes("cho nay") ||
    normalizedMessage.includes("cho do") ||
    normalizedMessage.includes("noi nay") ||
    normalizedMessage.includes("dia diem nay") ||
    normalizedMessage.includes("trong anh") ||
    normalizedMessage.includes("anh nay")
  );
}

function isImageSearchIntent(normalizedMessage) {
  return (
    normalizedMessage.includes("anh") ||
    normalizedMessage.includes("hinh") ||
    normalizedMessage.includes("xem them") ||
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

function isComparisonIntent(normalizedMessage) {
  return (
    normalizedMessage.includes("so voi") ||
    normalizedMessage.includes("hon") ||
    normalizedMessage.includes("khac gi") ||
    normalizedMessage.includes("giong")
  );
}

class ImageTextUnderstandingService {
  constructor(options = {}) {
    this.geminiClient = options.geminiClient || geminiClient;
    this.useFallbackWhenNotConfigured = options.useFallbackWhenNotConfigured ?? false;
  }

  async understand({ message, imagePlace = {}, context = {} }) {
    if (this.geminiClient.isConfigured?.()) {
      console.log("[ImageTextUnderstanding] Using Gemini LLM for image_text");
      return this.understandWithLlm({ message, imagePlace, context });
    }

    if (this.useFallbackWhenNotConfigured) {
      console.log(
        "[ImageTextUnderstanding] GEMINI_API_KEY/GEMINI_API_KEYS missing, using fallback heuristic",
      );
      return this.understandWithFallback({ message, imagePlace, context });
    }

    throw new LlmClassificationError(
      "GEMINI_API_KEY or GEMINI_API_KEYS is not configured.",
    );
  }

  async understandWithLlm({ message, imagePlace, context }) {
    try {
      const result = await this.geminiClient.generateJson({
        prompt: this.buildPrompt({ message, imagePlace, context }),
        responseJsonSchema: IMAGE_TEXT_UNDERSTANDING_SCHEMA,
        temperature: 0.1,
      });

      return this.validateLlmResult(result);
    } catch (error) {
      if (error instanceof LlmClassificationError) {
        throw error;
      }

      throw new LlmClassificationError(
        "Gemini image_text understanding returned invalid JSON.",
        {
          cause: error,
        },
      );
    }
  }

  buildPrompt({ message, imagePlace = {}, context = {} }) {
    const compactContext = {
      old_input: context.old_input || null,
      old_rewrite_query: context.old_rewrite_query || null,
      active_location_id: context.active_location_id || null,
      active_location_name: context.active_location_name || null,
      last_image_place_id: context.last_image_place_id || null,
      last_text_place_id: context.last_text_place_id || null,
      last_conflict: context.last_conflict || null,
    };
    const compactImagePlace = {
      image_place_id: imagePlace.location_id || imagePlace.image_place_id || null,
      image_place_name: imagePlace.location_name || imagePlace.image_place_name || null,
    };

    return [
      "Ban la Image + Text Understanding module cho Travel AI Assistant ve du lich Viet Nam.",
      "User da gui ca anh va text. Anh da duoc match sang image_place_id/image_place_name.",
      "Hay phan tich text de xac dinh dia diem cuoi cung dung cho retrieval.",
      "Tra ve DUY NHAT mot JSON object dung schema, khong markdown, khong giai thich.",
      "",
      "Bat buoc tra cac field:",
      IMAGE_TEXT_UNDERSTANDING_REQUIRED_FIELDS.join(", "),
      "",
      "Quy tac:",
      "- Neu text kieu 'o day', 'cho nay', 'dia diem nay', 'noi nay', 'trong anh' thi is_reference_question=true va final_place_id=image_place_id.",
      "- Neu text hoi xem/tim/them anh thi intent=image_search, need_images=true, need_metadata=true.",
      "- Neu text nhac ro dia diem khac anh thi text_place_id/text_place_name la dia diem trong text, final_place_id=text_place_id.",
      "- Neu text_place_id khac image_place_id, giu ca hai field de pipeline ghi conflict.",
      "- Neu khong biet location_id cua dia diem trong text thi tra text_place_id=null; khong tu bia ID.",
      "- rewrite_query phai ro nghia, uu tien them ten dia diem neu cau hoi tham chieu theo anh.",
      "- Khong them field ngoai schema.",
      "",
      `Intent hop le: ${IMAGE_TEXT_UNDERSTANDING_INTENTS.join(", ")}.`,
      "",
      `Image place JSON:\n${JSON.stringify(compactImagePlace, null, 2)}`,
      "",
      `Conversation context JSON:\n${JSON.stringify(compactContext, null, 2)}`,
      "",
      `Known location names helper JSON:\n${JSON.stringify(KNOWN_LOCATIONS, null, 2)}`,
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

    for (const field of IMAGE_TEXT_UNDERSTANDING_REQUIRED_FIELDS) {
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
    assertBoolean(result.is_reference_question, "is_reference_question");
    assertBoolean(result.is_specific_place_question, "is_specific_place_question");

    [
      "image_place_id",
      "image_place_name",
      "text_place_id",
      "text_place_name",
      "final_place_id",
      "final_place_name",
    ].forEach((field) => assertNullableString(result[field], field));

    if (!IMAGE_TEXT_UNDERSTANDING_INTENTS.includes(result.intent)) {
      throw new LlmClassificationError("intent is not valid.", {
        details: { value: result.intent },
      });
    }

    return {
      rewrite_query: result.rewrite_query.trim(),
      need_docs: result.need_docs,
      need_images: result.need_images,
      need_metadata: result.need_metadata,
      image_place_id: result.image_place_id || null,
      image_place_name: result.image_place_name || null,
      text_place_id: result.text_place_id || null,
      text_place_name: result.text_place_name || null,
      final_place_id: result.final_place_id || null,
      final_place_name: result.final_place_name || null,
      is_reference_question: result.is_reference_question,
      is_specific_place_question: result.is_specific_place_question,
      intent: result.intent,
    };
  }

  understandWithFallback({ message, imagePlace = {} }) {
    const normalized = normalizeText(message);
    const detectedLocation = detectLocation(message);
    const referenceQuestion = isReferenceQuestion(normalized);
    const imageIntent = isImageSearchIntent(normalized);
    const comparisonIntent = isComparisonIntent(normalized);
    const intent = this.detectIntent(normalized, {
      imageIntent,
      comparisonIntent,
    });
    const imagePlaceId = imagePlace.location_id || imagePlace.image_place_id || null;
    const imagePlaceName = imagePlace.location_name || imagePlace.image_place_name || null;
    const textPlaceId = detectedLocation?.location_id || null;
    const textPlaceName = detectedLocation?.location_name || null;
    const finalPlaceId = textPlaceId || imagePlaceId;
    const finalPlaceName = textPlaceName || imagePlaceName;

    return {
      rewrite_query: this.buildRewriteQuery({
        message,
        normalized,
        finalPlaceName,
        imagePlaceName,
        intent,
        referenceQuestion,
      }),
      need_docs: intent !== "image_search",
      need_images: intent === "image_search",
      need_metadata: true,
      image_place_id: imagePlaceId,
      image_place_name: imagePlaceName,
      text_place_id: textPlaceId,
      text_place_name: textPlaceName,
      final_place_id: finalPlaceId,
      final_place_name: finalPlaceName,
      is_reference_question: referenceQuestion,
      is_specific_place_question: Boolean(detectedLocation),
      intent,
    };
  }

  detectIntent(normalizedMessage, flags) {
    if (flags.comparisonIntent) {
      return "comparison";
    }

    if (flags.imageIntent) {
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

  buildRewriteQuery({
    message,
    normalized,
    finalPlaceName,
    imagePlaceName,
    intent,
    referenceQuestion,
  }) {
    const placeName = finalPlaceName || imagePlaceName;

    if (!referenceQuestion || !placeName) {
      return message;
    }

    if (intent === "image_search") {
      return `Anh ve ${placeName}`;
    }

    if (normalized.includes("choi") || normalized.includes("co gi")) {
      return `${placeName} co gi choi?`;
    }

    if (normalized.includes("dep")) {
      return `${placeName} dep khong?`;
    }

    if (normalized.includes("o dau") || normalized.includes("dia chi")) {
      return `${placeName} o dau?`;
    }

    return `${placeName}: ${message}`;
  }
}

const imageTextUnderstandingService = new ImageTextUnderstandingService();

module.exports = {
  IMAGE_TEXT_UNDERSTANDING_INTENTS,
  IMAGE_TEXT_UNDERSTANDING_SCHEMA,
  ImageTextUnderstandingService,
  imageTextUnderstandingService,
  isReferenceQuestion,
};
