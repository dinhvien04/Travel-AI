module.exports = {
  ...require("./image.repository"),
  ...require("./location.repository"),
  ...require("./qdrantFilters"),
  ...require("./qdrantClient"),
  ...require("./qdrant.repository"),
  ...require("./text.repository"),
};
