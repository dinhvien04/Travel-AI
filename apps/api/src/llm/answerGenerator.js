const { geminiClient } = require("./gemini.client");

function compactText(value, maxLength = 900) {
  const text = String(value || "").replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function compactDocs(docs = []) {
  return docs.slice(0, 6).map((doc) => ({
    rank: doc.rank || null,
    score: doc.score ?? null,
    section_title: doc.section_title || null,
    location_id: doc.location_id || null,
    location_name: doc.location_name || null,
    content: compactText(doc.content, 1000),
  }));
}

function compactImages(images = []) {
  return images.slice(0, 8).map((image) => ({
    rank: image.rank || null,
    image_id: image.image_id || null,
    title_name: image.title_name || null,
    caption: image.caption || image.caption_vi || image.caption_en || null,
    location_id: image.location_id || null,
    location_name: image.location_name || null,
    image_url: image.image_url || null,
  }));
}

class AnswerGenerator {
  constructor(options = {}) {
    this.geminiClient = options.geminiClient || geminiClient;
  }

  async generate({
    originalMessage,
    rewriteQuery,
    metadata,
    docs = [],
    images = [],
    intent,
    resolution = null,
  }) {
    console.log(
      `[AnswerGenerator] Gemini generate intent=${intent || "unknown"} docs=${docs.length} images=${images.length}`,
    );

    if (intent !== "image_search" && docs.length === 0) {
      return {
        text:
          "Mình chưa có đủ dữ liệu trong hệ thống để trả lời chắc chắn câu hỏi này.",
        markdown: true,
      };
    }

    if (intent === "image_search" && images.length === 0) {
      return {
        text:
          "Mình chưa tìm được ảnh phù hợp trong dữ liệu hiện có cho yêu cầu này.",
        markdown: true,
      };
    }

    if (!this.geminiClient.isConfigured?.()) {
      throw new Error(
        "GEMINI_API_KEY or GEMINI_API_KEYS is not configured for answer generation.",
      );
    }

    const text = await this.geminiClient.generateText({
      prompt: this.buildPrompt({
        originalMessage,
        rewriteQuery,
        metadata,
        docs,
        images,
        intent,
        resolution,
      }),
      generationConfig: {
        temperature: 0.2,
      },
    });

    return {
      text,
      markdown: true,
    };
  }

  buildPrompt({
    originalMessage,
    rewriteQuery,
    metadata,
    docs,
    images,
    intent,
    resolution = null,
  }) {
    const retrievalPayload = {
      original_message: originalMessage,
      rewrite_query: rewriteQuery,
      intent,
      place_resolution: resolution,
      location_metadata: metadata || null,
      docs: compactDocs(docs),
      answer_hint:
        resolution?.conflict?.conflict_type === "image_text_place_mismatch"
          ? "The image and text refer to different places. Mention this briefly, then answer using final_place_name."
          : null,
      images: compactImages(images),
    };

    return [
      "Bạn là Travel AI Assistant trả lời bằng tiếng Việt.",
      "Không dùng markdown bold/italic. Không dùng ký tự ** trong câu trả lời.",
      "Chỉ sử dụng dữ liệu retrieval JSON được cung cấp bên dưới.",
      "Không bịa thêm sự kiện, giá, giờ mở cửa, địa chỉ hoặc mô tả nếu không có trong dữ liệu.",
      "Nếu dữ liệu chưa đủ, hãy nói rõ là chưa có đủ dữ liệu.",
      "Nếu intent là image_search, trả lời ngắn gọn và nhắc rằng danh sách ảnh đã được gửi kèm trong response data.images.",
      "Có thể dùng markdown ngắn gọn.",
      "",
      `Retrieval JSON:\n${JSON.stringify(retrievalPayload, null, 2)}`,
    ].join("\n");
  }
}

const answerGenerator = new AnswerGenerator();

module.exports = {
  AnswerGenerator,
  compactDocs,
  compactImages,
  answerGenerator,
};
