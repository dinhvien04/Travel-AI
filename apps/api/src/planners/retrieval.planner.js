const { appConfig } = require("../config/env");

class RetrievalPlanner {
  constructor(options = {}) {
    this.config = options.config || appConfig;
  }

  plan(understanding) {
    return {
      shouldSearchDocs: Boolean(understanding.need_docs),
      shouldSearchImages: Boolean(understanding.need_images),
      shouldGetMetadata: Boolean(understanding.need_metadata),
      finalLocationId: understanding.location_id || null,
      finalLocationName: understanding.location_name || null,
      topKDocs: this.config.retrieval.topKDocs || 5,
      topKImages: this.config.retrieval.topKImages || 5,
      intent: understanding.intent || "unknown",
    };
  }
}

const retrievalPlanner = new RetrievalPlanner();

module.exports = {
  RetrievalPlanner,
  retrievalPlanner,
};
