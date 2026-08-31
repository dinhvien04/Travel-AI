const { appConfig } = require("../config/env");

class ConfidenceGuard {
  constructor(options = {}) {
    this.matchThreshold =
      options.matchThreshold ?? appConfig.retrieval.imageMatchThreshold;
    this.lowConfidenceThreshold =
      options.lowConfidenceThreshold ??
      appConfig.retrieval.imageLowConfidenceThreshold;
  }

  checkImageMatch(images = []) {
    const topImage = images[0] || null;
    const topScore = topImage?.score ?? 0;

    if (!topImage) {
      return {
        passed: false,
        status: "low_confidence",
        error_code: "LOW_CONFIDENCE_MATCH",
        message: "Mình chưa tìm được ảnh tương tự đủ tin cậy trong dữ liệu hiện có.",
        top_score: 0,
        candidates: [],
      };
    }

    if (topScore >= this.matchThreshold) {
      return {
        passed: true,
        status: "ok",
        error_code: null,
        message: "Image match is confident.",
        top_score: topScore,
        candidates: images,
      };
    }

    if (topScore >= this.lowConfidenceThreshold) {
      return {
        passed: false,
        status: "low_confidence",
        error_code: "LOW_CONFIDENCE_MATCH",
        message:
          "Mình tìm thấy một vài ảnh có thể liên quan nhưng độ tin cậy chưa đủ cao.",
        top_score: topScore,
        candidates: images,
      };
    }

    return {
      passed: false,
      status: "low_confidence",
      error_code: "LOW_CONFIDENCE_MATCH",
      message: "Ảnh này chưa khớp đủ tin cậy với dữ liệu du lịch hiện có.",
      top_score: topScore,
      candidates: images,
    };
  }
}

const confidenceGuard = new ConfidenceGuard();

module.exports = {
  ConfidenceGuard,
  confidenceGuard,
};
