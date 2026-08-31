const {
  IMAGE_VECTOR_NAME,
  imageRepository,
} = require("../repositories/image.repository");
const { locationRepository } = require("../repositories/location.repository");
const { TEXT_VECTOR_NAME, textRepository } = require("../repositories/text.repository");
const { s3Service } = require("../services/s3.service");
const { errorResponse, okResponse } = require("../utils/responseFormatter");

function getQdrantHttpStatus(errorCode) {
  if (errorCode === "QDRANT_CONNECTION_ERROR") {
    return 503;
  }

  if (errorCode === "QDRANT_COLLECTION_NOT_FOUND") {
    return 404;
  }

  if (errorCode === "QDRANT_VECTOR_NAME_ERROR") {
    return 400;
  }

  return 500;
}

function getVectorFromBody(body, camelCaseKey, snakeCaseKey) {
  return body?.[camelCaseKey] || body?.[snakeCaseKey];
}

function getTopKFromBody(body) {
  return body?.topK || body?.top_k;
}

function shouldAttachImageUrls(body) {
  return body?.attachImageUrls ?? body?.attach_image_urls ?? true;
}

class DebugController {
  async getLocation(req, res) {
    const locationId = req.params.location_id;

    console.log(`[Debug] GET location location_id=${locationId}`);

    try {
      const location = await locationRepository.getLocationById(locationId);

      return res.status(200).json(
        okResponse(
          {
            location,
          },
          {
            message: location ? "Location found." : "Location not found.",
          },
        ),
      );
    } catch (error) {
      return this.handleQdrantError(res, error);
    }
  }

  async hybridImageSearch(req, res) {
    const body = req.body || {};
    console.log("day la body", body);
    const siglipTextVector = getVectorFromBody(
      body,
      "siglipTextVector",
      "siglip_text_vector",
    );
    const bgeTextVector = getVectorFromBody(
      body, 
      "bgeTextVector", 
      "bge_text_vector",
    );

    console.log(
      `[Debug] POST hybrid image search query="${body.queryText || body.query_text || ""}" topK=${body.topK || body.top_k || "default"}`,
    );

    try {
      const images = await imageRepository.hybridSearchImagesByText({
        queryText: body.queryText || body.query_text || "",
        siglipTextVector,
        bgeTextVector,
        locationId: body.locationId || body.location_id,
        topK: body.topK || body.top_k,
        weights: body.weights,
      });
      const imagesWithUrls = await s3Service.attachImageUrls(images);

      return res.status(200).json(
        okResponse(
          {
            images: imagesWithUrls,
          },
          {
            message: "Hybrid image search debug result.",
          },
        ),
      );
    } catch (error) {
      return this.handleQdrantError(res, error);
    }
  }

  async searchDocsByTextVector(req, res) {
    const body = req.body || {};
    const textVector = getVectorFromBody(body, "textVector", "text_vector");

    console.log(
      `[Debug] POST docs search vector=${TEXT_VECTOR_NAME} vector_dim=${Array.isArray(textVector) ? textVector.length : "invalid"} topK=${getTopKFromBody(body) || "default"} locationId=${body.locationId || body.location_id || "all"}`,
    );

    try {
      const docs = await textRepository.searchDocsByTextVector({
        textVector,
        locationId: body.locationId || body.location_id,
        topK: getTopKFromBody(body),
      });

      return res.status(200).json(
        okResponse(
          {
            collection: "text_collection",
            vector_name: TEXT_VECTOR_NAME,
            count: docs.length,
            docs,
          },
          {
            message: "Text repository debug result.",
          },
        ),
      );
    } catch (error) {
      return this.handleQdrantError(res, error);
    }
  }

  async searchImagesByImageVector(req, res) {
    const body = req.body || {};
    const imageVector = getVectorFromBody(body, "imageVector", "image_vector");

    console.log(
      `[Debug] POST image vector search vector=${IMAGE_VECTOR_NAME} vector_dim=${Array.isArray(imageVector) ? imageVector.length : "invalid"} topK=${getTopKFromBody(body) || "default"} locationId=${body.locationId || body.location_id || "all"}`,
    );

    try {
      const images = await imageRepository.searchImagesByImageVector({
        imageVector,
        locationId: body.locationId || body.location_id,
        topK: getTopKFromBody(body),
      });
      const outputImages = shouldAttachImageUrls(body)
        ? await s3Service.attachImageUrls(images)
        : images;

      return res.status(200).json(
        okResponse(
          {
            collection: "image_collection",
            vector_name: IMAGE_VECTOR_NAME,
            count: outputImages.length,
            images: outputImages,
          },
          {
            message: "Image repository image_vector debug result.",
          },
        ),
      );
    } catch (error) {
      return this.handleQdrantError(res, error);
    }
  }

  async parseS3Path(req, res) {
    const s3Path = req.body?.s3_path || req.body?.s3Path;

    console.log(`[Debug] POST s3 parse path s3_path=${s3Path || "null"}`);

    const parsed = s3Service.parseS3Path(s3Path);
    const imageUrl = await s3Service.getImageUrlFromS3Path(s3Path);

    return res.status(200).json(
      okResponse(
        {
          s3_path: s3Path || null,
          bucket: parsed.bucket,
          s3_bucket: parsed.s3_bucket,
          s3_key: parsed.s3_key,
          image_url: imageUrl,
        },
        {
          message: "S3 path parsed.",
        },
      ),
    );
  }

  handleQdrantError(res, error) {
    const errorCode = error.code || "QDRANT_SEARCH_ERROR";
    const statusCode = getQdrantHttpStatus(errorCode);

    console.log(`[Debug] Qdrant error ${errorCode}: ${error.message}`);

    return res.status(statusCode).json(
      errorResponse(errorCode, error.message || "Qdrant debug request failed.", {
        data: error.details || null,
      }),
    );
  }
}

const debugController = new DebugController();

module.exports = {
  DebugController,
  debugController,
};
