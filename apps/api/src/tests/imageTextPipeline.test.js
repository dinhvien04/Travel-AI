const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ImageTextPipeline } = require("../pipelines/image-text.pipeline");
const { ContextService } = require("../services/context.service");

const testConfig = {
  qdrant: {
    collections: {
      location: "location_info",
      image: "image_collection",
      text: "text_collection",
    },
  },
  retrieval: {
    topKDocs: 5,
    topKImages: 5,
    imageMatchThreshold: 0.75,
    imageLowConfidenceThreshold: 0.55,
  },
};

function createImageFile() {
  return {
    fieldname: "image",
    originalname: "upload.jpg",
    mimetype: "image/jpeg",
    size: 4,
    buffer: Buffer.from([1, 2, 3, 4]),
  };
}

function createImage(overrides = {}) {
  return {
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
    location_key: "KY_CO",
    location_name: "Ky Co",
    score: 0.92,
    rank: 1,
    ...overrides,
  };
}

function createPipeline(overrides = {}) {
  const contextService = overrides.contextService || new ContextService();
  const attachCalls = [];
  const pipeline = new ImageTextPipeline({
    config: testConfig,
    contextService,
    imageEmbeddingService: {
      async embedImage(image) {
        assert.equal(image.originalname, "upload.jpg");
        return [0.1, 0.2];
      },
    },
    bgeM3EmbeddingService: {
      async embedText(text) {
        assert.ok(text);
        return [0.3, 0.4];
      },
    },
    siglipTextEmbeddingService: {
      async embedText(text) {
        assert.ok(text);
        return [0.5, 0.6];
      },
    },
    imageRepository: {
      async searchImagesByImageVector({ imageVector, topK }) {
        assert.deepEqual(imageVector, [0.1, 0.2]);
        assert.equal(topK, 5);
        return [createImage(overrides.matchedImage)];
      },
      async hybridSearchImagesByText(params) {
        if (overrides.onHybridSearchImagesByText) {
          overrides.onHybridSearchImagesByText(params);
        }

        return [
          createImage({
            image_id: "img-related",
            final_score: 0.88,
            siglip_score: 0.9,
            caption_score: 0.86,
            sources: ["siglip_text_to_image_vector", "caption_bge_m3_vector"],
          }),
        ];
      },
    },
    textRepository: {
      async searchDocsByTextVector(params) {
        if (overrides.onSearchDocsByTextVector) {
          overrides.onSearchDocsByTextVector(params);
        }

        return [
          {
            content: "Ky Co co bien xanh va canh quan dep.",
            location_id: params.locationId || "LOC_KC",
            location_name: params.locationId === "LOC_EG" ? "Eo Gio" : "Ky Co",
            score: 0.8,
            rank: 1,
          },
        ];
      },
    },
    locationRepository: {
      async findLocationByName(locationName) {
        if (overrides.onFindLocationByName) {
          return overrides.onFindLocationByName(locationName);
        }

        return null;
      },
      async getLocationById(locationId) {
        return {
          location_id: locationId,
          location_name: locationId === "LOC_EG" ? "Eo Gio" : "Ky Co",
          province: "Binh Dinh",
          description: "Mock location metadata.",
          tags: ["bien"],
        };
      },
    },
    s3Service: {
      async attachImageUrls(images) {
        attachCalls.push(images.map((image) => image.image_id));
        return images.map((image) => ({
          ...image,
          image_url: `https://example.com/${image.s3_key}`,
        }));
      },
    },
    imageTextUnderstandingService: {
      async understand() {
        return (
          overrides.understanding || {
            rewrite_query: "Ky Co co gi choi?",
            need_docs: true,
            need_images: false,
            need_metadata: true,
            image_place_id: "LOC_KC",
            image_place_name: "Ky Co",
            text_place_id: null,
            text_place_name: null,
            final_place_id: "LOC_KC",
            final_place_name: "Ky Co",
            is_reference_question: true,
            is_specific_place_question: false,
            intent: "activity",
          }
        );
      },
    },
    answerGenerator: {
      async generate(params) {
        if (overrides.onAnswerGenerate) {
          overrides.onAnswerGenerate(params);
        }

        return {
          text: "Mock answer",
          markdown: true,
        };
      },
    },
  });

  return {
    pipeline,
    contextService,
    attachCalls,
  };
}

test("image_text pipeline answers reference question using image place", async () => {
  const { pipeline, contextService, attachCalls } = createPipeline();

  const result = await pipeline.run({
    sessionId: "image-text-reference",
    message: "o day co gi choi?",
    inputType: "image_text",
    image: createImageFile(),
  });
  const context = contextService.getContext("image-text-reference");

  assert.equal(result.body.status, "ok");
  assert.equal(result.body.data.input_type, "image_text");
  assert.equal(result.body.data.pipeline, "image_text_pipeline");
  assert.equal(result.body.data.debug.image_place_id, "LOC_KC");
  assert.equal(result.body.data.debug.final_place_id, "LOC_KC");
  assert.equal(result.body.data.images[0].image_url, "https://example.com/KY_CO/image/ky-co.jpg");
  assert.equal(context.active_location_id, "LOC_KC");
  assert.equal(context.last_image_place_id, "LOC_KC");
  assert.deepEqual(attachCalls, [["img-1"]]);
});

test("image_text image_search uses hybrid image search and attaches related image URLs", async () => {
  let hybridCalled = false;
  const { pipeline, attachCalls } = createPipeline({
    understanding: {
      rewrite_query: "Anh ve Ky Co",
      need_docs: false,
      need_images: true,
      need_metadata: true,
      image_place_id: "LOC_KC",
      image_place_name: "Ky Co",
      text_place_id: null,
      text_place_name: null,
      final_place_id: "LOC_KC",
      final_place_name: "Ky Co",
      is_reference_question: true,
      is_specific_place_question: false,
      intent: "image_search",
    },
    onHybridSearchImagesByText(params) {
      hybridCalled = true;
      assert.equal(params.queryText, "Anh ve Ky Co");
      assert.equal(params.locationId, "LOC_KC");
      assert.deepEqual(params.weights, {
        siglip: 0.5,
        caption: 0.5,
      });
    },
    onAnswerGenerate(params) {
      assert.equal(params.intent, "image_search");
      assert.equal(params.images[0].image_id, "img-related");
    },
  });

  const result = await pipeline.run({
    sessionId: "image-text-images",
    message: "cho toi xem them anh cho nay",
    inputType: "image_text",
    image: createImageFile(),
  });

  assert.equal(result.body.status, "ok");
  assert.equal(hybridCalled, true);
  assert.equal(result.body.data.retrieval.need_images, true);
  assert.equal(result.body.data.images[0].image_id, "img-related");
  assert.equal(result.body.data.images[0].image_url, "https://example.com/KY_CO/image/ky-co.jpg");
  assert.equal(result.body.data.debug.hybrid_image_search.used, true);
  assert.deepEqual(attachCalls, [["img-1"], ["img-related"]]);
});

test("image_text pipeline records conflict and retrieves by text place", async () => {
  let docsLocationId = null;
  const { pipeline, contextService } = createPipeline({
    matchedImage: {
      image_id: "img-quy-hoa",
      s3_path: "vietnam-tourism/QUY_HOA/image/qh.jpg",
      s3_key: "QUY_HOA/image/qh.jpg",
      location_id: "LOC_QH",
      location_key: "QUY_HOA",
      location_name: "Quy Hoa",
      score: 0.91,
    },
    understanding: {
      rewrite_query: "Eo Gio co gi choi?",
      need_docs: true,
      need_images: false,
      need_metadata: true,
      image_place_id: "LOC_QH",
      image_place_name: "Quy Hoa",
      text_place_id: null,
      text_place_name: "Eo Gio",
      final_place_id: null,
      final_place_name: "Eo Gio",
      is_reference_question: false,
      is_specific_place_question: true,
      intent: "activity",
    },
    onFindLocationByName(locationName) {
      assert.equal(locationName, "Eo Gio");
      return {
        location_id: "LOC_EG",
        location_name: "Eo Gio",
      };
    },
    onSearchDocsByTextVector(params) {
      docsLocationId = params.locationId;
    },
  });

  const result = await pipeline.run({
    sessionId: "image-text-conflict",
    message: "Eo Gio co gi choi?",
    inputType: "image_text",
    image: createImageFile(),
  });
  const context = contextService.getContext("image-text-conflict");

  assert.equal(result.body.status, "ok");
  assert.equal(docsLocationId, "LOC_EG");
  assert.equal(result.body.data.debug.conflict.conflict_type, "image_text_place_mismatch");
  assert.equal(result.body.data.debug.image_place_id, "LOC_QH");
  assert.equal(result.body.data.debug.text_place_id, "LOC_EG");
  assert.equal(result.body.data.debug.final_place_id, "LOC_EG");
  assert.equal(context.active_location_id, "LOC_EG");
  assert.equal(context.last_image_place_id, "LOC_QH");
  assert.equal(context.last_text_place_id, "LOC_EG");
});

test("image_text pipeline returns low_confidence and does not update context", async () => {
  const { pipeline, contextService } = createPipeline({
    matchedImage: {
      score: 0.6,
    },
  });

  const result = await pipeline.run({
    sessionId: "image-text-low",
    message: "o day co gi choi?",
    inputType: "image_text",
    image: createImageFile(),
  });
  const context = contextService.getContext("image-text-low");

  assert.equal(result.body.status, "low_confidence");
  assert.equal(result.body.error_code, "LOW_CONFIDENCE_MATCH");
  assert.equal(result.body.data.candidate_locations[0].image_url, "https://example.com/KY_CO/image/ky-co.jpg");
  assert.equal(context.active_location_id, null);
});

test("image_text pipeline returns out_of_scope for very low image score", async () => {
  const { pipeline, contextService } = createPipeline({
    matchedImage: {
      score: 0.1,
    },
  });

  const result = await pipeline.run({
    sessionId: "image-text-out",
    message: "o day co gi choi?",
    inputType: "image_text",
    image: createImageFile(),
  });
  const context = contextService.getContext("image-text-out");

  assert.equal(result.body.status, "out_of_scope");
  assert.equal(result.body.error_code, "IMAGE_NOT_TRAVEL_RELATED");
  assert.equal(context.active_location_id, null);
});

test("image_text pipeline blocks out-of-domain text after valid image", async () => {
  let docsCalled = false;
  const { pipeline, contextService } = createPipeline({
    onSearchDocsByTextVector() {
      docsCalled = true;
    },
  });

  const result = await pipeline.run({
    sessionId: "image-text-code",
    message: "sua code Python giup toi",
    inputType: "image_text",
    image: createImageFile(),
  });
  const context = contextService.getContext("image-text-code");

  assert.equal(result.body.status, "out_of_scope");
  assert.equal(result.body.error_code, "TEXT_NOT_TRAVEL_RELATED");
  assert.equal(docsCalled, false);
  assert.equal(context.active_location_id, null);
});
