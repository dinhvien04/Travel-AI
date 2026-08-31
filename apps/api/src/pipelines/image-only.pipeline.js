const { appConfig } = require("../config/env");
const { bgeM3EmbeddingService } = require("../embeddings/bgeM3Embedding.service");
const { imageEmbeddingService } = require("../embeddings/imageEmbedding.service");
const { confidenceGuard } = require("../guards/confidence.guard");
const { answerGenerator } = require("../llm/answerGenerator");
const { imageRepository } = require("../repositories/image.repository");
const { locationRepository } = require("../repositories/location.repository");
const { textRepository } = require("../repositories/text.repository");
const { contextService } = require("../services/context.service");
const { fusionService } = require("../services/fusion.service");
const { s3Service } = require("../services/s3.service");
const {
  errorResponse,
  lowConfidenceResponse,
  okResponse,
} = require("../utils/responseFormatter");

const IMAGE_ONLY_PIPELINE_NAME = "image_only_pipeline";
const IMAGE_ONLY_DEFAULT_QUERY =
  "Đây là địa điểm nào và thông tin tổng quan là gì?";

function normalizeUploadedImage(image) {
  if (!image) {
    return null;
  }

  return {
    field_name: image.fieldname || "image",
    original_name: image.originalname || null,
    mime_type: image.mimetype || null,
    size: image.size || image.buffer?.length || 0,
  };
}

function validateUploadedImage(image) {
  if (!image?.buffer) {
    return {
      valid: false,
      error_code: "EMPTY_INPUT",
      message: "Please upload an image.",
    };
  }

  if (!String(image.mimetype || "").startsWith("image/")) {
    return {
      valid: false,
      error_code: "UNSUPPORTED_FILE_TYPE",
      message: "Only image files are supported for image_only pipeline.",
    };
  }

  return {
    valid: true,
  };
}

function buildSuggestedQuestions(locationName) {
  if (!locationName) {
    return [
      "Địa điểm trong ảnh này là gì?",
      "Có thông tin tổng quan nào về địa điểm này không?",
    ];
  }

  return [
    `${locationName} có gì đẹp?`,
    `${locationName} có gì chơi?`,
    `Cho tôi xem thêm ảnh ${locationName}`,
  ];
}

function getLocationIdFromMatch(matchedImage) {
  return matchedImage?.location_id || null;
}

function getLocationName({ metadata, matchedImage }) {
  return metadata?.location_name || matchedImage?.location_name || null;
}

class ImageOnlyPipeline {
  constructor(options = {}) {
    this.contextService = options.contextService || contextService;
    this.imageEmbeddingService = options.imageEmbeddingService || imageEmbeddingService;
    this.bgeM3EmbeddingService = options.bgeM3EmbeddingService || bgeM3EmbeddingService;
    this.imageRepository = options.imageRepository || imageRepository;
    this.textRepository = options.textRepository || textRepository;
    this.locationRepository = options.locationRepository || locationRepository;
    this.s3Service = options.s3Service || s3Service;
    this.confidenceGuard = options.confidenceGuard || confidenceGuard;
    this.fusionService = options.fusionService || fusionService;
    this.answerGenerator = options.answerGenerator || answerGenerator;
    this.config = options.config || appConfig;
  }

  async run({ sessionId, inputType, image }) {
    console.log(
      `[ImageOnlyPipeline] start session_id=${sessionId || "null"} input_type=${inputType}`,
    );

    if (inputType !== "image_only") {
      return {
        statusCode: 501,
        body: errorResponse(
          "PIPELINE_NOT_IMPLEMENTED",
          "Pipeline này chưa được implement trong phase hiện tại.",
          {
            data: {
              input_type: inputType,
              pipeline: IMAGE_ONLY_PIPELINE_NAME,
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
            input_type: "image_only",
            pipeline: IMAGE_ONLY_PIPELINE_NAME,
            uploaded_image: normalizeUploadedImage(image),
          },
        }),
      };
    }

    let matchedImages = [];

    try {
      const imageVector = await this.imageEmbeddingService.embedImage(image);
      const rawMatches = await this.imageRepository.searchImagesByImageVector({
        imageVector,
        topK: this.config.retrieval.topKImages,
      });

      matchedImages = await this.s3Service.attachImageUrls(rawMatches);
    } catch (error) {
      console.log(`[ImageOnlyPipeline] image search error: ${error.message}`);

      return {
        statusCode: 500,
        body: errorResponse(error.code || "QDRANT_SEARCH_ERROR", error.message, {
          data: {
            session_id: sessionId || null,
            input_type: "image_only",
            pipeline: IMAGE_ONLY_PIPELINE_NAME,
          },
        }),
      };
    }

    const confidence = this.confidenceGuard.checkImageMatch(matchedImages);

    if (!confidence.passed) {
      console.log(
        `[ImageOnlyPipeline] low confidence top_score=${confidence.top_score}`,
      );

      return {
        statusCode: 200,
        body: lowConfidenceResponse({
          errorCode: confidence.error_code,
          message: confidence.message,
          data: {
            session_id: sessionId || null,
            input_type: "image_only",
            pipeline: IMAGE_ONLY_PIPELINE_NAME,
            uploaded_image: normalizeUploadedImage(image),
            images: confidence.candidates,
            debug: {
              top_score: confidence.top_score,
              image_match_threshold: this.config.retrieval.imageMatchThreshold,
              image_low_confidence_threshold:
                this.config.retrieval.imageLowConfidenceThreshold,
            },
          },
        }),
      };
    }

    const matchedImage = matchedImages[0];
    const locationId = getLocationIdFromMatch(matchedImage);

    if (!locationId) {
      return {
        statusCode: 200,
        body: lowConfidenceResponse({
          errorCode: "IMAGE_LOCATION_NOT_FOUND",
          message:
            "Mình nhận diện được ảnh tương tự nhưng chưa có location_id để lấy thông tin địa điểm.",
          data: {
            session_id: sessionId || null,
            input_type: "image_only",
            pipeline: IMAGE_ONLY_PIPELINE_NAME,
            matched_image: matchedImage,
            images: matchedImages,
          },
        }),
      };
    }

    let metadata = null;
    let docs = [];
    const retrievalErrors = [];

    try {
      metadata = await this.locationRepository.getLocationById(locationId);
    } catch (error) {
      this.recordRetrievalError(retrievalErrors, "metadata", error);
    }

    try {
      const defaultQueryVector = await this.bgeM3EmbeddingService.embedText(
        IMAGE_ONLY_DEFAULT_QUERY,
      );
      docs = await this.textRepository.searchDocsByTextVector({
        textVector: defaultQueryVector,
        locationId,
        topK: this.config.retrieval.topKDocs,
      });
    } catch (error) {
      this.recordRetrievalError(retrievalErrors, "docs", error);
    }

    const fusedContext = this.fusionService.fuse({
      message: IMAGE_ONLY_DEFAULT_QUERY,
      rewriteQuery: IMAGE_ONLY_DEFAULT_QUERY,
      docs,
      images: matchedImages,
      metadata,
      plan: {
        shouldSearchDocs: true,
        shouldSearchImages: true,
        shouldGetMetadata: true,
        finalLocationId: locationId,
        finalLocationName: getLocationName({ metadata, matchedImage }),
        topKDocs: this.config.retrieval.topKDocs,
        topKImages: this.config.retrieval.topKImages,
        intent: "overview",
      },
      debug: {
        retrieval_errors: retrievalErrors,
      },
    });
    let answer;

    try {
      answer = await this.answerGenerator.generate({
        originalMessage: IMAGE_ONLY_DEFAULT_QUERY,
        rewriteQuery: IMAGE_ONLY_DEFAULT_QUERY,
        metadata,
        docs,
        images: matchedImages,
        intent: "overview",
        fusedContext,
      });
    } catch (error) {
      console.log(`[ImageOnlyPipeline] answer generation error: ${error.message}`);

      return {
        statusCode: 500,
        body: errorResponse(
          "INTERNAL_ERROR",
          "Không thể tạo câu trả lời từ Gemini trong image_only pipeline.",
        ),
      };
    }

    const locationName = getLocationName({ metadata, matchedImage });
    const suggestedQuestions = buildSuggestedQuestions(locationName);
    const data = {
      session_id: sessionId || null,
      input_type: "image_only",
      pipeline: IMAGE_ONLY_PIPELINE_NAME,
      default_query: IMAGE_ONLY_DEFAULT_QUERY,
      answer,
      location: metadata,
      matched_image: matchedImage,
      images: matchedImages,
      retrieval: {
        default_query: IMAGE_ONLY_DEFAULT_QUERY,
        matched_image_id: matchedImage.image_id,
        location_id: locationId,
        location_name: locationName,
        need_docs: true,
        need_images: false,
        need_metadata: true,
        top_k_docs: this.config.retrieval.topKDocs,
        top_k_images: this.config.retrieval.topKImages,
      },
      debug: {
        uploaded_image: normalizeUploadedImage(image),
        docs_count: docs.length,
        images_count: matchedImages.length,
        top_score: matchedImage.score,
        used_collections: [
          this.config.qdrant.collections.image,
          this.config.qdrant.collections.location,
          this.config.qdrant.collections.text,
        ],
        retrieval_errors: retrievalErrors,
      },
      suggested_questions: suggestedQuestions,
    };

    this.contextService.updateOnSuccess(sessionId, {
      old_input: "[image_only]",
      old_rewrite_query: IMAGE_ONLY_DEFAULT_QUERY,
      active_location_id: locationId,
      active_location_name: locationName,
      last_returned_images: matchedImages,
      last_text_place_id: locationId,
      last_conflict: null,
    });

    console.log(
      `[ImageOnlyPipeline] done image_id=${matchedImage.image_id || "null"} location_id=${locationId}`,
    );

    return {
      statusCode: 200,
      body: okResponse(data, {
        message: null,
        suggestedQuestions,
      }),
    };
  }

  recordRetrievalError(errors, source, error) {
    console.log(
      `[ImageOnlyPipeline] retrieval error source=${source} code=${error.code || "UNKNOWN"} message=${error.message}`,
    );
    errors.push({
      source,
      error_code: error.code || "QDRANT_SEARCH_ERROR",
      message: error.message,
    });
  }
}

const imageOnlyPipeline = new ImageOnlyPipeline();

module.exports = {
  IMAGE_ONLY_DEFAULT_QUERY,
  IMAGE_ONLY_PIPELINE_NAME,
  ImageOnlyPipeline,
  imageOnlyPipeline,
  normalizeUploadedImage,
  validateUploadedImage,
};
