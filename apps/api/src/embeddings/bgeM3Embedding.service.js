const { appConfig } = require("../config/env");
const { BgeM3ModelClient } = require("./embedding.client");

class BgeM3EmbeddingService {
  constructor(options = {}) {
    const config = options.config || appConfig;

    this.modelId = options.modelId || config.embeddings.bgeM3Model;
    this.dimension = options.dimension || config.embeddings.bgeM3VectorDim;
    this.client =
      options.client ||
      new BgeM3ModelClient({
        config,
        modelId: this.modelId,
        expectedDimension: this.dimension,
        normalize: options.normalize,
      });
  }

  async embedText(text) {
    console.log(
      `[BgeM3EmbeddingService] embed text model=${this.modelId} length=${String(text || "").length} dim=${this.dimension}`,
    );

    return this.client.embedText(text);
  }
}

const bgeM3EmbeddingService = new BgeM3EmbeddingService();

module.exports = {
  BgeM3EmbeddingService,
  bgeM3EmbeddingService,
};
