module.exports = {
  ...require("./bgeM3Embedding.service"),
  ...require("./embedding.client"),
  ...require("./imageEmbedding.service"),
  ...require("./siglipTextEmbedding.service"),
};
