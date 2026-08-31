const { appConfig } = require("../config/env");
const { SiglipImageModelClient } = require("./embedding.client");

class ImageEmbeddingService {
  constructor(options = {}) {
    const config = options.config || appConfig;

    this.modelId = options.modelId || config.embeddings.siglipModel;
    this.dimension = options.dimension || config.embeddings.siglipImageVectorDim;
    this.client =
      options.client ||
      new SiglipImageModelClient({
        config,
        modelId: this.modelId,
        expectedDimension: this.dimension,
        normalize: options.normalize,
      });
  }

  async embedImage(image) {
    if (!image?.buffer || !Buffer.isBuffer(image.buffer)) {
      throw new Error("Image buffer is required for image embedding.");
    }

    console.log(
      `[ImageEmbeddingService] embed image model=${this.modelId} original_name=${image.originalname || "null"} size=${image.size || image.buffer.length} dim=${this.dimension}`,
    );

    return this.client.embedImage(image);
  }
}

const imageEmbeddingService = new ImageEmbeddingService();

module.exports = {
  ImageEmbeddingService,
  imageEmbeddingService,
};
