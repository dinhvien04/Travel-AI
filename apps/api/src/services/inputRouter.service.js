const INPUT_TYPES = Object.freeze({
  TEXT_ONLY: "text_only",
  IMAGE_ONLY: "image_only",
  IMAGE_TEXT: "image_text",
  EMPTY_INPUT: "empty_input",
});

function normalizeMessage(message) {
  if (typeof message !== "string") {
    return "";
  }

  return message.trim();
}

function buildImageSummary(image) {
  if (!image) {
    return null;
  }

  return {
    field_name: image.fieldname || "image",
    original_name: image.originalname || null,
    mime_type: image.mimetype || null,
    size: image.size || 0,
  };
}

class InputRouterService {
  route({ sessionId, message, image }) {
    const normalizedMessage = normalizeMessage(message);
    const hasMessage = normalizedMessage.length > 0;
    const hasImage = Boolean(image);
    const inputType = this.classify({ hasMessage, hasImage });

    console.log(
      `[InputRouter] has_message=${hasMessage} has_image=${hasImage} -> input_type=${inputType}`,
    );

    if (hasImage) {
      console.log(
        `[InputRouter] image original_name=${image.originalname || "null"} mime_type=${image.mimetype || "null"} size=${image.size || 0}`,
      );
    }

    return {
      session_id: sessionId || null,
      input_type: inputType,
      message: hasMessage ? normalizedMessage : null,
      image: buildImageSummary(image),
    };
  }

  classify({ hasMessage, hasImage }) {
    if (hasMessage && hasImage) {
      return INPUT_TYPES.IMAGE_TEXT;
    }

    if (hasMessage) {
      return INPUT_TYPES.TEXT_ONLY;
    }

    if (hasImage) {
      return INPUT_TYPES.IMAGE_ONLY;
    }

    return INPUT_TYPES.EMPTY_INPUT;
  }
}

const inputRouterService = new InputRouterService();

module.exports = {
  INPUT_TYPES,
  inputRouterService,
  InputRouterService,
};
