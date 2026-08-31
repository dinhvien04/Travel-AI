const { appConfig } = require("../config/env");
const { bgeM3EmbeddingService } = require("../embeddings/bgeM3Embedding.service");
const { siglipTextEmbeddingService } = require("../embeddings/siglipTextEmbedding.service");
const { textDomainGuard } = require("../guards/textDomain.guard");
const { answerGenerator } = require("../llm/answerGenerator");
const { textUnderstandingService } = require("../llm/textUnderstanding");
const { retrievalPlanner } = require("../planners/retrieval.planner");
const { imageRepository } = require("../repositories/image.repository");
const { locationRepository } = require("../repositories/location.repository");
const { textRepository } = require("../repositories/text.repository");
const { contextService } = require("../services/context.service");
const { fusionService } = require("../services/fusion.service");
const { referenceResolver } = require("../services/referenceResolver.service");
const { s3Service } = require("../services/s3.service");
const {
  errorResponse,
  needClarificationResponse,
  okResponse,
  outOfScopeResponse,
} = require("../utils/responseFormatter");

const PIPELINE_NAME = "text_only_pipeline";

function buildSuggestedQuestions(locationName) {
  if (!locationName) {
    return [
      "Bạn muốn tìm địa điểm du lịch nào ở Gia Lai?",
      "Bạn muốn xem ảnh hay hỏi thông tin về địa điểm?",
    ];
  }

  return [
    `${locationName} có gì chơi?`,
    `Cho tôi xem ảnh ${locationName}`,
    `${locationName} ở đâu?`,
  ];
}

function getFirstLocationId({ metadata, docs, images, understanding }) {
  return (
    metadata?.location_id ||
    understanding.location_id ||
    docs.find((doc) => doc.location_id)?.location_id ||
    images.find((image) => image.location_id)?.location_id ||
    null
  );
}

function getFirstLocationName({ metadata, docs, images, understanding }) {
  return (
    metadata?.location_name ||
    understanding.location_name ||
    images.find((image) => image.location_name)?.location_name ||
    docs.find((doc) => doc.location_name)?.location_name ||
    null
  );
}

class TextOnlyPipeline {
  constructor(options = {}) {
    this.contextService = options.contextService || contextService;
    this.domainGuard = options.domainGuard || textDomainGuard;
    this.textUnderstandingService =
      options.textUnderstandingService || textUnderstandingService;
    this.referenceResolver = options.referenceResolver || referenceResolver;
    this.retrievalPlanner = options.retrievalPlanner || retrievalPlanner;
    this.bgeM3EmbeddingService = options.bgeM3EmbeddingService || bgeM3EmbeddingService;
    this.siglipTextEmbeddingService =
      options.siglipTextEmbeddingService || siglipTextEmbeddingService;
    this.textRepository = options.textRepository || textRepository;
    this.imageRepository = options.imageRepository || imageRepository;
    this.locationRepository = options.locationRepository || locationRepository;
    this.s3Service = options.s3Service || s3Service;
    this.fusionService = options.fusionService || fusionService;
    this.answerGenerator = options.answerGenerator || answerGenerator;
    this.config = options.config || appConfig;
  }

  async run({ sessionId, message, inputType }) {
    console.log(
      `[TextOnlyPipeline] start session_id=${sessionId || "null"} input_type=${inputType}`,
    );

    if (inputType !== "text_only") {
      return {
        statusCode: 501,
        body: errorResponse(
          "PIPELINE_NOT_IMPLEMENTED",
          "Pipeline này chưa được implement trong phase hiện tại.",
          {
            data: {
              input_type: inputType,
              pipeline: PIPELINE_NAME,
            },
          },
        ),
      };
    }

    const context = this.contextService.getContext(sessionId);
    const guardResult = this.domainGuard.check(message, context);

    if (!guardResult.allowed) {
      console.log(
        `[TextOnlyPipeline] guard blocked status=${guardResult.status} error=${guardResult.error_code}`,
      );

      if (guardResult.status === "need_clarification") {
        this.contextService.setPendingQuestion(sessionId, {
          message,
          error_code: guardResult.error_code,
        });

        return {
          statusCode: 200,
          body: needClarificationResponse({
            errorCode: guardResult.error_code,
            message: guardResult.message,
          }),
        };
      }

      if (guardResult.status === "out_of_scope") {
        return {
          statusCode: 200,
          body: outOfScopeResponse({
            errorCode: guardResult.error_code,
            message: guardResult.message,
          }),
        };
      }

      return {
        statusCode: 400,
        body: errorResponse(guardResult.error_code || "EMPTY_INPUT", guardResult.message),
      };
    }

    let understanding;

    try {
      understanding = await this.textUnderstandingService.understand({
        message,
        context,
      });
    } catch (error) {
      console.log(`[TextOnlyPipeline] LLM classification error: ${error.message}`);

      return {
        statusCode: 500,
        body: errorResponse(
          "LLM_CLASSIFICATION_ERROR",
          "Không thể phân tích câu hỏi text trong phase hiện tại.",
        ),
      };
    }

    const resolvedUnderstanding = this.referenceResolver.resolve({
      message,
      understanding,
      context,
    });
    const plan = this.retrievalPlanner.plan(resolvedUnderstanding);
    const retrievalDebug = {
      retrieval_errors: [],
      used_collections: [],
    };
    let docs = [];
    let images = [];
    let metadata = null;
    let bgeTextVector = null;

    if (plan.shouldSearchDocs) {
      retrievalDebug.used_collections.push(this.config.qdrant.collections.text);
      try {
        bgeTextVector = await this.bgeM3EmbeddingService.embedText(
          resolvedUnderstanding.rewrite_query,
        );
        docs = await this.textRepository.searchDocsByTextVector({
          textVector: bgeTextVector,
          locationId: plan.finalLocationId,
          topK: plan.topKDocs,
        });
      } catch (error) {
        this.recordRetrievalError(retrievalDebug, "docs", error);
      }
    }

    const locationIdFromDocs = docs.find((doc) => doc.location_id)?.location_id;
    if (!plan.finalLocationId && locationIdFromDocs) {
      plan.finalLocationId = locationIdFromDocs;
    }

    if (plan.shouldSearchImages) {
      retrievalDebug.used_collections.push(this.config.qdrant.collections.image);
      try {
        if (!bgeTextVector) {
          bgeTextVector = await this.bgeM3EmbeddingService.embedText(
            resolvedUnderstanding.rewrite_query,
          );
        }

        const siglipTextVector = await this.siglipTextEmbeddingService.embedText(
          resolvedUnderstanding.rewrite_query,
        );
        const rawImages = await this.imageRepository.hybridSearchImagesByText({
          queryText: resolvedUnderstanding.rewrite_query,
          siglipTextVector,
          bgeTextVector,
          locationId: plan.finalLocationId,
          topK: plan.topKImages,
          weights: {
            siglip: 0.3,
            caption: 0.7,
          },
        });

        images = await this.s3Service.attachImageUrls(rawImages);
      } catch (error) {
        this.recordRetrievalError(retrievalDebug, "images", error);
      }
    }

    const locationIdFromImages = images.find((image) => image.location_id)?.location_id;
    if (!plan.finalLocationId && locationIdFromImages) {
      plan.finalLocationId = locationIdFromImages;
    }

    if (plan.shouldGetMetadata && plan.finalLocationId) {
      retrievalDebug.used_collections.push(this.config.qdrant.collections.location);
      try {
        metadata = await this.locationRepository.getLocationById(plan.finalLocationId);
      } catch (error) {
        this.recordRetrievalError(retrievalDebug, "metadata", error);
      }
    }

    const finalLocationId = getFirstLocationId({
      metadata,
      docs,
      images,
      understanding: resolvedUnderstanding,
    });
    const finalLocationName = getFirstLocationName({
      metadata,
      docs,
      images,
      understanding: resolvedUnderstanding,
    });
    const suggestedQuestions = buildSuggestedQuestions(finalLocationName);
    const fusedContext = this.fusionService.fuse({
      message,
      rewriteQuery: resolvedUnderstanding.rewrite_query,
      docs,
      images,
      metadata,
      plan,
      debug: retrievalDebug,
    });
    let answer;

    try {
      answer = await this.answerGenerator.generate({
        originalMessage: message,
        rewriteQuery: resolvedUnderstanding.rewrite_query,
        metadata,
        docs,
        images,
        intent: resolvedUnderstanding.intent,
        fusedContext,
      });
    } catch (error) {
      console.log(`[TextOnlyPipeline] answer generation error: ${error.message}`);

      return {
        statusCode: 500,
        body: errorResponse(
          "INTERNAL_ERROR",
          "Không thể tạo câu trả lời từ Gemini trong phase hiện tại.",
        ),
      };
    }
    const data = {
      session_id: sessionId || null,
      input_type: "text_only",
      pipeline: PIPELINE_NAME,
      answer,
      location: metadata,
      images,
      retrieval: {
        rewrite_query: resolvedUnderstanding.rewrite_query,
        need_docs: resolvedUnderstanding.need_docs,
        need_images: resolvedUnderstanding.need_images,
        need_metadata: resolvedUnderstanding.need_metadata,
        is_follow_up: resolvedUnderstanding.is_follow_up,
        intent: resolvedUnderstanding.intent,
        location_id: finalLocationId,
        location_name: finalLocationName,
        top_k_docs: plan.topKDocs,
        top_k_images: plan.topKImages,
      },
      debug: {
        docs_count: docs.length,
        images_count: images.length,
        used_collections: [...new Set(retrievalDebug.used_collections)],
        retrieval_errors: retrievalDebug.retrieval_errors,
      },
      suggested_questions: suggestedQuestions,
    };

    this.contextService.updateOnSuccess(sessionId, {
      old_input: message,
      old_rewrite_query: resolvedUnderstanding.rewrite_query,
      active_location_id: finalLocationId,
      active_location_name: finalLocationName,
      last_returned_images: images,
      last_text_place_id: finalLocationId,
      last_conflict: null,
    });

    console.log(
      `[TextOnlyPipeline] done docs=${docs.length} images=${images.length} location_id=${finalLocationId || "null"}`,
    );

    return {
      statusCode: 200,
      body: okResponse(data, {
        message: null,
        suggestedQuestions,
      }),
    };
  }

  recordRetrievalError(debug, source, error) {
    console.log(
      `[TextOnlyPipeline] retrieval error source=${source} code=${error.code || "UNKNOWN"} message=${error.message}`,
    );
    debug.retrieval_errors.push({
      source,
      error_code: error.code || "QDRANT_SEARCH_ERROR",
      message: error.message,
    });
  }
}

const textOnlyPipeline = new TextOnlyPipeline();

module.exports = {
  PIPELINE_NAME,
  TextOnlyPipeline,
  textOnlyPipeline,
};
