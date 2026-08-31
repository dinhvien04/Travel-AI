const assert = require("node:assert/strict");
const { test } = require("node:test");

const { TextDomainGuard } = require("../guards/textDomain.guard");
const { AnswerGenerator } = require("../llm/answerGenerator");
const { TextUnderstandingService } = require("../llm/textUnderstanding");
const { TextOnlyPipeline } = require("../pipelines/text-only.pipeline");
const { ContextService } = require("../services/context.service");

test("text domain guard blocks non-travel questions", () => {
  const guard = new TextDomainGuard();
  const result = guard.check("ban sua code Python giup toi", {});

  assert.equal(result.allowed, false);
  assert.equal(result.status, "out_of_scope");
  assert.equal(result.error_code, "TEXT_NOT_TRAVEL_RELATED");
});

test("text domain guard allows ambiguous follow-up without context", () => {
  const guard = new TextDomainGuard();
  const result = guard.check("o do co gi choi?", {});

  assert.equal(result.allowed, true);
});

test("text understanding fallback rewrites follow-up using active location", async () => {
  const service = new TextUnderstandingService({
    geminiClient: {
      isConfigured() {
        return false;
      },
    },
    useFallbackWhenNotConfigured: true,
  });
  const result = await service.understand({
    message: "o do co gi choi?",
    context: {
      active_location_id: "LOC_001",
      active_location_name: "Bien Quy Hoa",
    },
  });

  assert.equal(result.is_follow_up, true);
  assert.equal(result.location_id, "LOC_001");
  assert.equal(result.rewrite_query, "Bien Quy Hoa co gi choi?");
});

test("text understanding uses Gemini client when configured", async () => {
  let llmCalled = false;
  const service = new TextUnderstandingService({
    geminiClient: {
      isConfigured() {
        return true;
      },
      async generateJson({ prompt, responseJsonSchema }) {
        llmCalled = true;
        assert.ok(prompt.includes("User message"));
        assert.equal(responseJsonSchema.type, "object");

        return {
          rewrite_query: "Anh dep ve Ky Co",
          need_docs: false,
          need_images: true,
          need_metadata: true,
          location_id: null,
          location_name: "Ky Co",
          is_follow_up: false,
          intent: "image_search",
        };
      },
    },
  });

  const result = await service.understand({
    message: "Cho toi xem anh Ky Co",
    context: {},
  });

  assert.equal(llmCalled, true);
  assert.equal(result.intent, "image_search");
  assert.equal(result.need_images, true);
  assert.equal(result.rewrite_query, "Anh dep ve Ky Co");
});

test("text understanding rejects invalid Gemini JSON schema", async () => {
  const service = new TextUnderstandingService({
    geminiClient: {
      isConfigured() {
        return true;
      },
      async generateJson() {
        return {
          rewrite_query: "Ky Co",
          need_docs: false,
        };
      },
    },
  });

  await assert.rejects(
    () =>
      service.understand({
        message: "Cho toi xem anh Ky Co",
        context: {},
      }),
    /missing field/i,
  );
});

test("answer generator uses Gemini and sends retrieval-only prompt", async () => {
  let promptText = "";
  const generator = new AnswerGenerator({
    geminiClient: {
      isConfigured() {
        return true;
      },
      async generateText({ prompt }) {
        promptText = prompt;
        return "Day la cau tra loi tu Gemini.";
      },
    },
  });

  const answer = await generator.generate({
    originalMessage: "Bien Quy Hoa co gi dep?",
    rewriteQuery: "Bien Quy Hoa co gi dep?",
    metadata: {
      location_name: "Bien Quy Hoa",
    },
    docs: [
      {
        content: "Bien Quy Hoa yen tinh va co canh quan dep.",
      },
    ],
    images: [],
    intent: "overview",
  });

  assert.equal(answer.text, "Day la cau tra loi tu Gemini.");
  assert.ok(promptText.includes("Retrieval JSON"));
});

test("answer generator does not call Gemini when docs are missing for info intent", async () => {
  let called = false;
  const generator = new AnswerGenerator({
    geminiClient: {
      isConfigured() {
        return true;
      },
      async generateText() {
        called = true;
        return "Should not be called";
      },
    },
  });

  const answer = await generator.generate({
    originalMessage: "Bien Quy Hoa co gi dep?",
    rewriteQuery: "Bien Quy Hoa co gi dep?",
    metadata: null,
    docs: [],
    images: [],
    intent: "overview",
  });

  assert.equal(called, false);
  assert.match(answer.text, /chưa có đủ dữ liệu/i);
});

test("text-only pipeline returns out_of_scope without retrieval", async () => {
  let searchCalled = false;
  const pipeline = new TextOnlyPipeline({
    contextService: new ContextService(),
    textRepository: {
      async searchDocsByTextVector() {
        searchCalled = true;
        return [];
      },
    },
  });

  const result = await pipeline.run({
    sessionId: "s1",
    message: "Messi la ai?",
    inputType: "text_only",
  });

  assert.equal(result.body.status, "out_of_scope");
  assert.equal(result.body.error_code, "TEXT_NOT_TRAVEL_RELATED");
  assert.equal(searchCalled, false);
});

test("text-only pipeline returns LLM_CLASSIFICATION_ERROR on bad Gemini JSON", async () => {
  const pipeline = new TextOnlyPipeline({
    contextService: new ContextService(),
    textUnderstandingService: new TextUnderstandingService({
      geminiClient: {
        isConfigured() {
          return true;
        },
        async generateJson() {
          return {
            rewrite_query: "Ky Co",
          };
        },
      },
    }),
  });

  const result = await pipeline.run({
    sessionId: "s-bad-json",
    message: "Cho toi xem anh Ky Co",
    inputType: "text_only",
  });

  assert.equal(result.body.status, "error");
  assert.equal(result.body.error_code, "LLM_CLASSIFICATION_ERROR");
});

test("text-only pipeline handles overview question and updates context", async () => {
  const contextService = new ContextService();
  const pipeline = new TextOnlyPipeline({
    contextService,
    textUnderstandingService: new TextUnderstandingService({
      geminiClient: {
        isConfigured() {
          return false;
        },
      },
      useFallbackWhenNotConfigured: true,
    }),
    answerGenerator: {
      async generate() {
        return {
          text: "Mock answer",
          markdown: true,
        };
      },
    },
    bgeM3EmbeddingService: {
      async embedText() {
        return [0.1, 0.2];
      },
    },
    textRepository: {
      async searchDocsByTextVector() {
        return [
          {
            content: "Bien Quy Hoa co bai bien yen tinh va canh quan dep.",
            location_id: "LOC_QH",
            location_name: "Bien Quy Hoa",
            score: 0.9,
            rank: 1,
          },
        ];
      },
    },
    locationRepository: {
      async getLocationById() {
        return {
          location_id: "LOC_QH",
          location_name: "Bien Quy Hoa",
          province: "Binh Dinh",
          description: "Mot bai bien yen tinh gan Quy Nhon.",
          tags: ["bien"],
        };
      },
    },
  });

  const result = await pipeline.run({
    sessionId: "s2",
    message: "bien quy hoa co gi dep?",
    inputType: "text_only",
  });
  const context = contextService.getContext("s2");

  assert.equal(result.body.status, "ok");
  assert.equal(result.body.data.input_type, "text_only");
  assert.equal(result.body.data.pipeline, "text_only_pipeline");
  assert.equal(result.body.data.retrieval.need_docs, true);
  assert.equal(context.active_location_id, "LOC_QH");
});

test("text-only pipeline handles image search and attaches image URLs", async () => {
  const pipeline = new TextOnlyPipeline({
    contextService: new ContextService(),
    textUnderstandingService: new TextUnderstandingService({
      geminiClient: {
        isConfigured() {
          return false;
        },
      },
      useFallbackWhenNotConfigured: true,
    }),
    answerGenerator: {
      async generate() {
        return {
          text: "Mock image answer",
          markdown: true,
        };
      },
    },
    bgeM3EmbeddingService: {
      async embedText() {
        return [0.1, 0.2];
      },
    },
    siglipTextEmbeddingService: {
      async embedText() {
        return [0.3, 0.4];
      },
    },
    imageRepository: {
      async hybridSearchImagesByText() {
        return [
          {
            image_id: "img-1",
            title_name: "ky-co.jpg",
            s3_path: "vietnam-tourism/KY_CO/image/ky-co.jpg",
            s3_bucket: "vietnam-tourism",
            s3_key: "KY_CO/image/ky-co.jpg",
            image_url: null,
            caption: "Ky Co",
            caption_vi: "Ky Co",
            caption_en: null,
            location_id: "LOC_KC",
            location_name: "Ky Co",
            final_score: 0.8,
            siglip_score: 0.7,
            caption_score: 0.9,
            sources: ["siglip_text_to_image_vector", "caption_bge_m3_vector"],
            rank: 1,
          },
        ];
      },
    },
    locationRepository: {
      async getLocationById() {
        return null;
      },
    },
    s3Service: {
      async attachImageUrls(images) {
        return images.map((image) => ({
          ...image,
          image_url: `https://example.com/${image.s3_key}`,
        }));
      },
    },
  });

  const result = await pipeline.run({
    sessionId: "s3",
    message: "cho toi xem anh ky co",
    inputType: "text_only",
  });

  assert.equal(result.body.status, "ok");
  assert.equal(result.body.data.retrieval.need_images, true);
  assert.equal(result.body.data.images[0].image_url, "https://example.com/KY_CO/image/ky-co.jpg");
});
