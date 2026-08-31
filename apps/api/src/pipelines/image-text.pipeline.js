const { appConfig } = require("../config/env");
const { bgeM3EmbeddingService } = require("../embeddings/bgeM3Embedding.service");
const { imageEmbeddingService } = require("../embeddings/imageEmbedding.service");
const { siglipTextEmbeddingService } = require("../embeddings/siglipTextEmbedding.service");
const { textDomainGuard } = require("../guards/textDomain.guard");
const { answerGenerator } = require("../llm/answerGenerator");
const { imageTextUnderstandingService } = require("../llm/imageTextUnderstanding");
const { imageRepository } = require("../repositories/image.repository");
const { locationRepository } = require("../repositories/location.repository");
const { textRepository } = require("../repositories/text.repository");
const { contextService } = require("../services/context.service");
const { fusionService } = require("../services/fusion.service");
const { imageTextResolver } = require("../services/imageTextResolver.service");
const { s3Service } = require("../services/s3.service");
const {
  errorResponse,
  lowConfidenceResponse,
  okResponse,
  outOfScopeResponse,
} = require("../utils/responseFormatter");
const {
  normalizeUploadedImage,
  validateUploadedImage,
} = require("./image-only.pipeline");

const IMAGE_TEXT_PIPELINE_NAME = "image_text_pipeline";
const HYBRID_IMAGE_SEARCH_BRANCHES = [
  "siglip_text_to_image_vector",
  "caption_bge_m3_vector",
];

function buildSuggestedQuestions(locationName) {
  if (!locationName) {
    return [
      "Dia diem nay o dau?",
      "O day co gi choi?",
      "Cho toi xem them anh cho nay",
    ];
  }

  return [
    `${locationName} co gi choi?`,
    `${locationName} o dau?`,
    `Cho toi xem them anh ${locationName}`,
  ];
}

function getScore(image) {
  const score = image?.score ?? image?.final_score ?? 0;
  const parsed = Number(score);

  return Number.isFinite(parsed) ? parsed : 0;
}

function getFinalLocationName({ metadata, docs, images, resolved }) {
  return (
    metadata?.location_name ||
    resolved.final_place_name ||
    images.find((image) => image.location_id === resolved.final_place_id)
      ?.location_name ||
    docs.find((doc) => doc.location_id === resolved.final_place_id)?.location_name ||
    null
  );
}

function uniqueCollections(collections, config) {
  const unique = [...new Set(collections.filter(Boolean))];
  const preferredOrder = [
    config.qdrant.collections.location,
    config.qdrant.collections.text,
    config.qdrant.collections.image,
  ];

  return preferredOrder.filter((collection) => unique.includes(collection));
}

class ImageTextPipeline {
  constructor(options = {}) {
    this.contextService = options.contextService || contextService;
    this.imageEmbeddingService = options.imageEmbeddingService || imageEmbeddingService;
    this.bgeM3EmbeddingService = options.bgeM3EmbeddingService || bgeM3EmbeddingService;
    this.siglipTextEmbeddingService =
      options.siglipTextEmbeddingService || siglipTextEmbeddingService;
    this.imageRepository = options.imageRepository || imageRepository;
    this.textRepository = options.textRepository || textRepository;
    this.locationRepository = options.locationRepository || locationRepository;
    this.s3Service = options.s3Service || s3Service;
    this.textDomainGuard = options.textDomainGuard || textDomainGuard;
    this.imageTextUnderstandingService =
      options.imageTextUnderstandingService || imageTextUnderstandingService;
    this.imageTextResolver = options.imageTextResolver || imageTextResolver;
    this.fusionService = options.fusionService || fusionService;
    this.answerGenerator = options.answerGenerator || answerGenerator;
    this.config = options.config || appConfig;
  }

  async run({ sessionId, message, inputType, image }) {
    console.log(
      `[ImageTextPipeline] start session_id=${sessionId || "null"} input_type=${inputType}`,
    );

    if (inputType !== "image_text") {
      return {
        statusCode: 501,
        body: errorResponse(
          "PIPELINE_NOT_IMPLEMENTED",
          "This pipeline only handles image_text input.",
          {
            data: {
              input_type: inputType,
              pipeline: IMAGE_TEXT_PIPELINE_NAME,
            },
          },
        ),
      };
    }

    const validation = validateUploadedImage(image);

    if (!validation.valid) {
      return {
        statusCode: validation.error_code === "EMPTY_INPUT" ? 400 : 415,
        body: errorResponse(validation.error_code, validation.message, {
          data: {
            session_id: sessionId || null,
            input_type: "image_text",
            pipeline: IMAGE_TEXT_PIPELINE_NAME,
            uploaded_image: normalizeUploadedImage(image),
          },
        }),
      };
    }

    const context = this.contextService.getContext(sessionId);
    const retrievalDebug = {
      retrieval_errors: [],
      used_collections: [this.config.qdrant.collections.image],
      hybrid_image_search: {
        used: false,
        branches: [],
      },
    };

    let matchedImages = [];

    try {
      const imageVector = await this.imageEmbeddingService.embedImage(image);
      const rawMatches = await this.imageRepository.searchImagesByImageVector({
        imageVector,
        topK: this.config.retrieval.topKImages,
      });

      matchedImages = await this.s3Service.attachImageUrls(rawMatches);
    } catch (error) {
      console.log(`[ImageTextPipeline] image search error: ${error.message}`);

      return {
        statusCode: 500,
        body: errorResponse(error.code || "QDRANT_SEARCH_ERROR", error.message, {
          data: {
            session_id: sessionId || null,
            input_type: "image_text",
            pipeline: IMAGE_TEXT_PIPELINE_NAME,
          },
        }),
      };
    }

    const imageConfidence = this.evaluateImageConfidence(matchedImages);

    if (imageConfidence.status === "out_of_scope") {
      console.log(
        `[ImageTextPipeline] image out_of_scope top_score=${imageConfidence.top_score}`,
      );

      return {
        statusCode: 200,
        body: outOfScopeResponse({
          errorCode: "IMAGE_NOT_TRAVEL_RELATED",
          message:
            "Image does not confidently match a supported travel location in the current data.",
          data: {
            session_id: sessionId || null,
            input_type: "image_text",
            pipeline: IMAGE_TEXT_PIPELINE_NAME,
            uploaded_image: normalizeUploadedImage(image),
            candidate_locations: matchedImages,
            images: matchedImages,
            debug: {
              top_score: imageConfidence.top_score,
              image_match_threshold: this.config.retrieval.imageMatchThreshold,
              image_low_confidence_threshold:
                this.config.retrieval.imageLowConfidenceThreshold,
              used_collections: uniqueCollections(
                retrievalDebug.used_collections,
                this.config,
              ),
            },
          },
        }),
      };
    }

    if (imageConfidence.status === "low_confidence") {
      console.log(
        `[ImageTextPipeline] low confidence top_score=${imageConfidence.top_score}`,
      );

      return {
        statusCode: 200,
        body: lowConfidenceResponse({
          errorCode: "LOW_CONFIDENCE_MATCH",
          message:
            "Found possible image matches, but the similarity score is not confident enough.",
          data: {
            session_id: sessionId || null,
            input_type: "image_text",
            pipeline: IMAGE_TEXT_PIPELINE_NAME,
            uploaded_image: normalizeUploadedImage(image),
            candidate_locations: matchedImages,
            images: matchedImages,
            debug: {
              top_score: imageConfidence.top_score,
              image_match_threshold: this.config.retrieval.imageMatchThreshold,
              image_low_confidence_threshold:
                this.config.retrieval.imageLowConfidenceThreshold,
              used_collections: uniqueCollections(
                retrievalDebug.used_collections,
                this.config,
              ),
            },
          },
        }),
      };
    }

    const matchedImage = matchedImages[0];
    const imagePlace = {
      location_id: matchedImage?.location_id || null,
      location_name: matchedImage?.location_name || null,
    };

    if (!imagePlace.location_id) {
      return {
        statusCode: 200,
        body: lowConfidenceResponse({
          errorCode: "IMAGE_LOCATION_NOT_FOUND",
          message:
            "Image matched a similar item, but the image payload does not contain location_id.",
          data: {
            session_id: sessionId || null,
            input_type: "image_text",
            pipeline: IMAGE_TEXT_PIPELINE_NAME,
            matched_image: matchedImage,
            images: matchedImages,
          },
        }),
      };
    }

    const imageContext = {
      ...context,
      active_location_id: imagePlace.location_id,
      active_location_name: imagePlace.location_name,
      last_image_place_id: imagePlace.location_id,
      last_returned_images: matchedImages,
    };
    const guardResult = this.textDomainGuard.check(message, imageContext);

    if (!guardResult.allowed) {
      console.log(
        `[ImageTextPipeline] text guard blocked status=${guardResult.status} error=${guardResult.error_code}`,
      );

      if (guardResult.status === "out_of_scope") {
        return {
          statusCode: 200,
          body: outOfScopeResponse({
            errorCode: "TEXT_NOT_TRAVEL_RELATED",
            message: guardResult.message,
            data: {
              session_id: sessionId || null,
              input_type: "image_text",
              pipeline: IMAGE_TEXT_PIPELINE_NAME,
              matched_image: matchedImage,
              debug: {
                image_place_id: imagePlace.location_id,
                image_place_name: imagePlace.location_name,
                image_similarity_score: getScore(matchedImage),
              },
            },
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
      understanding = await this.imageTextUnderstandingService.understand({
        message,
        imagePlace,
        context: imageContext,
      });
      understanding = await this.enrichUnderstandingLocation(
        understanding,
        retrievalDebug,
      );
    } catch (error) {
      console.log(
        `[ImageTextPipeline] LLM classification error: ${error.message}`,
      );

      return {
        statusCode: 500,
        body: errorResponse(
          "LLM_CLASSIFICATION_ERROR",
          "Cannot classify image_text request with Gemini.",
        ),
      };
    }

    const resolved = this.imageTextResolver.resolve({
      message,
      understanding,
      imagePlace,
      matchedImage,
      context: imageContext,
    });
    const plan = this.buildPlan(resolved);
    let docs = [];
    let relatedImages = [];
    let metadata = null;
    let bgeTextVector = null;

    if (plan.shouldSearchDocs) {
      retrievalDebug.used_collections.push(this.config.qdrant.collections.text);
      try {
        bgeTextVector = await this.bgeM3EmbeddingService.embedText(
          resolved.rewrite_query,
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

    if (plan.shouldSearchImages) {
      retrievalDebug.used_collections.push(this.config.qdrant.collections.image);
      retrievalDebug.hybrid_image_search = {
        used: true,
        branches: HYBRID_IMAGE_SEARCH_BRANCHES,
      };

      try {
        if (!bgeTextVector) {
          bgeTextVector = await this.bgeM3EmbeddingService.embedText(
            resolved.rewrite_query,
          );
        }

        const siglipTextVector = await this.siglipTextEmbeddingService.embedText(
          resolved.rewrite_query,
        );
        const rawRelatedImages = await this.imageRepository.hybridSearchImagesByText({
          queryText: resolved.rewrite_query,
          siglipTextVector,
          bgeTextVector,
          locationId: plan.finalLocationId,
          topK: plan.topKImages,
          weights: {
            siglip: 0.5,
            caption: 0.5,
          },
        });

        relatedImages = await this.s3Service.attachImageUrls(rawRelatedImages);
      } catch (error) {
        this.recordRetrievalError(retrievalDebug, "images", error);
      }
    }

    if (plan.shouldGetMetadata && plan.finalLocationId) {
      retrievalDebug.used_collections.push(this.config.qdrant.collections.location);
      try {
        metadata = await this.locationRepository.getLocationById(plan.finalLocationId);
      } catch (error) {
        this.recordRetrievalError(retrievalDebug, "metadata", error);
      }
    }

    const responseImages = plan.shouldSearchImages
      ? relatedImages
      : matchedImage
        ? [matchedImage]
        : [];
    const finalLocationName = getFinalLocationName({
      metadata,
      docs,
      images: responseImages,
      resolved,
    });
    const suggestedQuestions = buildSuggestedQuestions(finalLocationName);
    const responsePlan = {
      ...plan,
      finalLocationName,
      conflict: resolved.conflict,
    };
    const fusedContext = this.fusionService.fuse({
      message,
      rewriteQuery: resolved.rewrite_query,
      docs,
      images: responseImages,
      metadata,
      plan: responsePlan,
      debug: retrievalDebug,
      resolution: resolved,
    });
    let answer;

    try {
      answer = await this.answerGenerator.generate({
        originalMessage: message,
        rewriteQuery: resolved.rewrite_query,
        metadata,
        docs,
        images: responseImages,
        intent: resolved.intent,
        fusedContext,
        resolution: {
          image_place_id: resolved.image_place_id,
          image_place_name: resolved.image_place_name,
          text_place_id: resolved.text_place_id,
          text_place_name: resolved.text_place_name,
          final_place_id: resolved.final_place_id,
          final_place_name: finalLocationName,
          conflict: resolved.conflict,
        },
      });
    } catch (error) {
      console.log(`[ImageTextPipeline] answer generation error: ${error.message}`);

      return {
        statusCode: 500,
        body: errorResponse(
          "INTERNAL_ERROR",
          "Cannot generate image_text answer with Gemini.",
        ),
      };
    }

    const data = {
      session_id: sessionId || null,
      input_type: "image_text",
      pipeline: IMAGE_TEXT_PIPELINE_NAME,
      answer,
      location: metadata,
      matched_image: matchedImage,
      images: responseImages,
      retrieval: {
        rewrite_query: resolved.rewrite_query,
        need_docs: resolved.need_docs,
        need_images: resolved.need_images,
        need_metadata: resolved.need_metadata,
        is_follow_up: resolved.is_reference_question,
        is_reference_question: resolved.is_reference_question,
        is_specific_place_question: resolved.is_specific_place_question,
        intent: resolved.intent,
        location_id: resolved.final_place_id,
        location_name: finalLocationName,
        top_k_docs: plan.topKDocs,
        top_k_images: plan.topKImages,
      },
      debug: {
        matched_image_id: matchedImage?.image_id || null,
        image_place_id: resolved.image_place_id,
        image_place_name: resolved.image_place_name,
        text_place_id: resolved.text_place_id,
        text_place_name: resolved.text_place_name,
        final_place_id: resolved.final_place_id,
        final_place_name: finalLocationName,
        image_similarity_score: getScore(matchedImage),
        docs_count: docs.length,
        images_count: responseImages.length,
        used_collections: uniqueCollections(retrievalDebug.used_collections, this.config),
        hybrid_image_search: retrievalDebug.hybrid_image_search,
        retrieval_errors: retrievalDebug.retrieval_errors,
        conflict: resolved.conflict,
      },
      suggested_questions: suggestedQuestions,
    };

    this.contextService.updateOnSuccess(sessionId, {
      old_input: message,
      old_rewrite_query: resolved.rewrite_query,
      active_location_id: resolved.final_place_id,
      active_location_name: finalLocationName,
      last_image_place_id: resolved.image_place_id,
      last_text_place_id: resolved.text_place_id,
      last_returned_images: responseImages,
      last_conflict: resolved.conflict,
    });

    console.log(
      `[ImageTextPipeline] done image_place_id=${resolved.image_place_id || "null"} final_place_id=${resolved.final_place_id || "null"} docs=${docs.length} images=${responseImages.length}`,
    );

    return {
      statusCode: 200,
      body: okResponse(data, {
        message: null,
        suggestedQuestions,
      }),
    };
  }

  evaluateImageConfidence(images = []) {
    const topImage = images[0] || null;
    const topScore = getScore(topImage);

    if (!topImage || topScore < this.config.retrieval.imageLowConfidenceThreshold) {
      return {
        status: "out_of_scope",
        top_score: topScore,
      };
    }

    if (topScore < this.config.retrieval.imageMatchThreshold) {
      return {
        status: "low_confidence",
        top_score: topScore,
      };
    }

    return {
      status: "ok",
      top_score: topScore,
    };
  }

  buildPlan(resolved) {
    return {
      shouldSearchDocs: Boolean(resolved.need_docs),
      shouldSearchImages: Boolean(resolved.need_images),
      shouldGetMetadata: Boolean(resolved.need_metadata),
      finalLocationId: resolved.final_place_id || null,
      finalLocationName: resolved.final_place_name || null,
      topKDocs: this.config.retrieval.topKDocs || 5,
      topKImages: this.config.retrieval.topKImages || 5,
      intent: resolved.intent || "unknown",
    };
  }

  async enrichUnderstandingLocation(understanding, debug) {
    const lookupName =
      !understanding.text_place_id &&
      (understanding.text_place_name ||
        (understanding.is_specific_place_question
          ? understanding.final_place_name
          : null));

    if (!lookupName || typeof this.locationRepository.findLocationByName !== "function") {
      return understanding;
    }

    debug.used_collections.push(this.config.qdrant.collections.location);

    try {
      const location = await this.locationRepository.findLocationByName(lookupName);

      if (!location?.location_id) {
        return understanding;
      }

      return {
        ...understanding,
        text_place_id: location.location_id,
        text_place_name: location.location_name || understanding.text_place_name,
        final_place_id: understanding.final_place_id || location.location_id,
        final_place_name:
          understanding.final_place_name ||
          location.location_name ||
          understanding.text_place_name,
      };
    } catch (error) {
      this.recordRetrievalError(debug, "location_name_resolution", error);
      return understanding;
    }
  }

  recordRetrievalError(debug, source, error) {
    console.log(
      `[ImageTextPipeline] retrieval error source=${source} code=${error.code || "UNKNOWN"} message=${error.message}`,
    );
    debug.retrieval_errors.push({
      source,
      error_code: error.code || "QDRANT_SEARCH_ERROR",
      message: error.message,
    });
  }
}

const imageTextPipeline = new ImageTextPipeline();

module.exports = {
  HYBRID_IMAGE_SEARCH_BRANCHES,
  IMAGE_TEXT_PIPELINE_NAME,
  ImageTextPipeline,
  imageTextPipeline,
};
