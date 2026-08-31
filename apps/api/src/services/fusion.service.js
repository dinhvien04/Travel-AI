class FusionService {
  fuse({
    message,
    rewriteQuery,
    docs = [],
    images = [],
    metadata = null,
    plan,
    debug,
    resolution = null,
  }) {
    return {
      question: message,
      rewrite_query: rewriteQuery,
      resolution,
      location: metadata,
      docs,
      images,
      retrieval_plan: plan,
      retrieval_debug: debug,
    };
  }
}

const fusionService = new FusionService();

module.exports = {
  FusionService,
  fusionService,
};
