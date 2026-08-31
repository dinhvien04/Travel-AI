const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  formatImageResponseItem,
  lowConfidenceResponse,
  needClarificationResponse,
  okResponse,
  outOfScopeResponse,
} = require("../utils/responseFormatter");

test("okResponse returns unified ApiResponse contract", () => {
  const response = okResponse({ status: "ok" }, { message: "Healthy" });

  assert.deepEqual(Object.keys(response), [
    "success",
    "status",
    "error_code",
    "message",
    "data",
    "suggested_questions",
  ]);
  assert.equal(response.success, true);
  assert.equal(response.status, "ok");
  assert.equal(response.error_code, null);
  assert.equal(response.message, "Healthy");
});

test("special responses keep suggested questions in the unified field", () => {
  const suggestedQuestions = ["Ban muon tim diem den nao?"];

  assert.deepEqual(
    outOfScopeResponse({ suggestedQuestions }).suggested_questions,
    suggestedQuestions,
  );
  assert.equal(needClarificationResponse().error_code, "NEED_CLARIFICATION");
  assert.equal(lowConfidenceResponse().status, "low_confidence");
});

test("formatImageResponseItem parses bucket and key from s3_path", () => {
  const imageItem = formatImageResponseItem(
    {
      image_id: "img-1",
      s3_path: "vietnam-tourism/HON_KHO/image/00008_xxx.jpg",
      title_name: "Hon Kho",
    },
    { finalScore: 0.92, rank: 1 },
  );

  assert.equal(imageItem.s3_bucket, "vietnam-tourism");
  assert.equal(imageItem.s3_key, "HON_KHO/image/00008_xxx.jpg");
  assert.equal(imageItem.final_score, 0.92);
  assert.equal(imageItem.rank, 1);
});
