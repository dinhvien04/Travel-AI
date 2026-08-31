const { appConfig } = require("../config/env");
const { SiglipTextModelClient } = require("./embedding.client");

class SiglipTextEmbeddingService {
  constructor(options = {}) {
    const config = options.config || appConfig;

    this.modelId = options.modelId || config.embeddings.siglipModel;
    this.dimension = options.dimension || config.embeddings.siglipTextVectorDim;
    this.client =
      options.client ||
      new SiglipTextModelClient({
        config,
        modelId: this.modelId,
        expectedDimension: this.dimension,
        normalize: options.normalize,
      });
  }

  async embedText(text) {
    console.log(
      `[SiglipTextEmbeddingService] embed text model=${this.modelId} length=${String(text || "").length} dim=${this.dimension}`,
    );

    return this.client.embedText(text);
  }
}

const siglipTextEmbeddingService = new SiglipTextEmbeddingService();

module.exports = {
  SiglipTextEmbeddingService,
  siglipTextEmbeddingService,
};
