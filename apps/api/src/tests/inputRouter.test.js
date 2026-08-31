const assert = require("node:assert/strict");
const { test } = require("node:test");

const { inputRouterService } = require("../services/inputRouter.service");

test("input router classifies text only", () => {
  const result = inputRouterService.route({
    sessionId: "s1",
    message: " Xin chao ",
  });

  assert.equal(result.input_type, "text_only");
  assert.equal(result.message, "Xin chao");
  assert.equal(result.image, null);
  assert.equal(Object.hasOwn(result, "mock"), false);
  assert.equal(Object.hasOwn(result, "note"), false);
});

test("input router classifies image only", () => {
  const result = inputRouterService.route({
    sessionId: "s1",
    image: {
      fieldname: "image",
      originalname: "photo.jpg",
      mimetype: "image/jpeg",
      size: 123,
    },
  });

  assert.equal(result.input_type, "image_only");
  assert.equal(result.message, null);
  assert.equal(result.image.original_name, "photo.jpg");
});

test("input router classifies image and text", () => {
  const result = inputRouterService.route({
    sessionId: "s1",
    message: "Day la dau?",
    image: {
      fieldname: "image",
      originalname: "photo.jpg",
      mimetype: "image/jpeg",
      size: 123,
    },
  });

  assert.equal(result.input_type, "image_text");
});

test("input router classifies empty input", () => {
  const result = inputRouterService.route({
    sessionId: "s1",
    message: "   ",
  });

  assert.equal(result.input_type, "empty_input");
});
