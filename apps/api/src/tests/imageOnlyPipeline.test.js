const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ConfidenceGuard } = require("../guards/confidence.guard");
const {
  IMAGE_ONLY_DEFAULT_QUERY,
  ImageOnlyPipeline,
  validateUploadedImage,
} = require("../pipelines/image-only.pipeline");
const { ContextService } = require("../services/context.service");

function createImageFile() {
  return {
    fieldname: "image",
    originalname: "upload.jpg",
    mimetype: "image/jpeg",
    size: 4,
    buffer: Buffer.from([1, 2, 3, 4]),
  };
}

test("validateUploadedImage accepts multer image file", () => {
  assert.equal(validateUploadedImage(createImageFile()).valid, true);
});

test("validateUploadedImage rejects non-image upload", () => {
  const result = validateUploadedImage({
    originalname: "file.txt",
    mimetype: "text/plain",
    buffer: Buffer.from("abc"),
  });

  assert.equal(result.valid, false);
  assert.equal(result.error_code, "UNSUPPORTED_FILE_TYPE");
});

test("confidence guard passes only top score above threshold", () => {
  const guard = new ConfidenceGuard({
    matchThreshold: 0.75,
    lowConfidenceThreshold: 0.55,
  });

  assert.equal(guard.checkImageMatch([{ score: 0.8 }]).passed, true);
  assert.equal(guard.checkImageMatch([{ score: 0.6 }]).passed, false);
  assert.equal(guard.checkImageMatch([{ score: 0.2 }]).error_code, "LOW_CONFIDENCE_MATCH");
});

test("image-only pipeline succeeds and updates context", async () => {
  let attachCalled = false;
  const contextService = new ContextService();
  const pipeline = new ImageOnlyPipeline({
    contextService,
    imageEmbeddingService: {
      async embedImage(image) {
        assert.equal(image.originalname, "upload.jpg");
        return [0.1, 0.2];
      },
    },
    imageRepository: {
      async searchImagesByImageVector({ imageVector, topK }) {
        assert.deepEqual(imageVector, [0.1, 0.2]);
        assert.equal(topK, 5);

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
            location_key: "KY_CO",
            location_name: "Ky Co",
            score: 0.92,
            rank: 1,
          },
        ];
      },
    },
    s3Service: {
      async attachImageUrls(images) {
        attachCalled = true;
        return images.map((image) => ({
          ...image,
          image_url: `https://example.com/${image.s3_key}`,
        }));
      },
    },
    locationRepository: {
      async getLocationById(locationId) {
        assert.equal(locationId, "LOC_KC");
        return {
          location_id: "LOC_KC",
          location_name: "Ky Co",
          province: "Binh Dinh",
          description: "Ky Co la diem den bien dao noi bat.",
          tags: ["bien"],
        };
      },
    },
    bgeM3EmbeddingService: {
      async embedText(text) {
        assert.equal(text, IMAGE_ONLY_DEFAULT_QUERY);
        return [0.3, 0.4];
      },
    },
    textRepository: {
      async searchDocsByTextVector({ locationId }) {
        assert.equal(locationId, "LOC_KC");
        return [
          {
            content: "Ky Co co bien xanh va canh quan dep.",
            location_id: "LOC_KC",
            location_name: "Ky Co",
            rank: 1,
            score: 0.8,
          },
        ];
      },
    },
    answerGenerator: {
      async generate({ docs, images }) {
        assert.equal(docs.length, 1);
        assert.equal(images[0].image_url, "https://example.com/KY_CO/image/ky-co.jpg");
        return {
          text: "Day la Ky Co.",
          markdown: true,
        };
      },
    },
  });

  const result = await pipeline.run({
    sessionId: "image-session",
    inputType: "image_only",
    image: createImageFile(),
  });
  const context = contextService.getContext("image-session");

  assert.equal(attachCalled, true);
  assert.equal(result.body.status, "ok");
  assert.equal(result.body.data.input_type, "image_only");
  assert.equal(result.body.data.pipeline, "image_only_pipeline");
  assert.equal(result.body.data.matched_image.image_url, "https://example.com/KY_CO/image/ky-co.jpg");
  assert.equal(context.active_location_id, "LOC_KC");
});

test("image-only pipeline returns low confidence and does not update context", async () => {
  const contextService = new ContextService();
  const pipeline = new ImageOnlyPipeline({
    contextService,
    imageEmbeddingService: {
      async embedImage() {
        return [0.1, 0.2];
      },
    },
    imageRepository: {
      async searchImagesByImageVector() {
        return [
          {
            image_id: "img-low",
            s3_path: "vietnam-tourism/LOW/image/low.jpg",
            s3_bucket: "vietnam-tourism",
            s3_key: "LOW/image/low.jpg",
            image_url: null,
            score: 0.3,
            rank: 1,
          },
        ];
      },
    },
    s3Service: {
      async attachImageUrls(images) {
        return images.map((image) => ({
          ...image,
          image_url: "https://example.com/low.jpg",
        }));
      },
    },
  });

  const result = await pipeline.run({
    sessionId: "low-session",
    inputType: "image_only",
    image: createImageFile(),
  });
  const context = contextService.getContext("low-session");

  assert.equal(result.body.status, "low_confidence");
  assert.equal(result.body.error_code, "LOW_CONFIDENCE_MATCH");
  assert.equal(result.body.data.images[0].image_url, "https://example.com/low.jpg");
  assert.equal(context.active_location_id, null);
});
