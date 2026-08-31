const { normalizeText } = require("../utils/text");

function samePlace(left, right) {
  return Boolean(left && right && left === right);
}

function isDifferentPlace(left, right) {
  return Boolean(left && right && left !== right);
}

function includesLocationName(query, locationName) {
  if (!query || !locationName) {
    return false;
  }

  return normalizeText(query).includes(normalizeText(locationName));
}

function inferRewriteQuery({ message, normalizedMessage, locationName, intent }) {
  if (!locationName) {
    return message;
  }

  if (intent === "image_search") {
    return `Anh ve ${locationName}`;
  }

  if (normalizedMessage.includes("choi") || normalizedMessage.includes("co gi")) {
    return `${locationName} co gi choi?`;
  }

  if (normalizedMessage.includes("dep")) {
    return `${locationName} dep khong?`;
  }

  if (normalizedMessage.includes("o dau") || normalizedMessage.includes("dia chi")) {
    return `${locationName} o dau?`;
  }

  return `${locationName}: ${message}`;
}

class ImageTextResolver {
  resolve({ message, understanding, imagePlace = {}, matchedImage = {} }) {
    const normalizedMessage = normalizeText(message);
    const imagePlaceId =
      understanding.image_place_id ||
      imagePlace.location_id ||
      imagePlace.image_place_id ||
      matchedImage.location_id ||
      null;
    const imagePlaceName =
      understanding.image_place_name ||
      imagePlace.location_name ||
      imagePlace.image_place_name ||
      matchedImage.location_name ||
      null;
    const textPlaceId = understanding.text_place_id || null;
    const textPlaceName = understanding.text_place_name || null;
    let finalPlaceId = understanding.final_place_id || null;
    let finalPlaceName = understanding.final_place_name || null;
    let conflict = null;

    if (textPlaceId) {
      finalPlaceId = textPlaceId;
      finalPlaceName = textPlaceName || finalPlaceName;
    } else if (textPlaceName && understanding.is_specific_place_question) {
      if (imagePlaceName && normalizeText(imagePlaceName) === normalizeText(textPlaceName)) {
        finalPlaceId = imagePlaceId;
        finalPlaceName = imagePlaceName;
      } else {
        finalPlaceId = null;
        finalPlaceName = textPlaceName || finalPlaceName;
      }
    }

    if (
      !finalPlaceId &&
      !textPlaceName &&
      (understanding.is_reference_question || !textPlaceId)
    ) {
      finalPlaceId = imagePlaceId;
      finalPlaceName = imagePlaceName || finalPlaceName;
    }

    if (samePlace(finalPlaceId, imagePlaceId) && !finalPlaceName) {
      finalPlaceName = imagePlaceName;
    }

    if (samePlace(finalPlaceId, textPlaceId) && !finalPlaceName) {
      finalPlaceName = textPlaceName;
    }

    const hasNameConflict =
      imagePlaceName &&
      textPlaceName &&
      normalizeText(imagePlaceName) !== normalizeText(textPlaceName);

    if (isDifferentPlace(imagePlaceId, textPlaceId) || hasNameConflict) {
      conflict = {
        conflict_type: "image_text_place_mismatch",
        image_place_id: imagePlaceId,
        image_place_name: imagePlaceName,
        text_place_id: textPlaceId,
        text_place_name: textPlaceName,
        final_place_id: finalPlaceId,
        final_place_name: finalPlaceName,
      };
    }

    const intent = understanding.intent || "unknown";
    const needImages = intent === "image_search" || Boolean(understanding.need_images);
    const rewriteQuery =
      (understanding.is_reference_question &&
        finalPlaceName &&
        !includesLocationName(understanding.rewrite_query, finalPlaceName))
        ? inferRewriteQuery({
            message,
            normalizedMessage,
            locationName: finalPlaceName,
            intent,
          })
        : understanding.rewrite_query;

    return {
      ...understanding,
      rewrite_query: rewriteQuery,
      need_docs:
        intent === "image_search" ? Boolean(understanding.need_docs) : Boolean(understanding.need_docs),
      need_images: needImages,
      need_metadata: Boolean(understanding.need_metadata) || Boolean(finalPlaceId),
      image_place_id: imagePlaceId,
      image_place_name: imagePlaceName,
      text_place_id: textPlaceId,
      text_place_name: textPlaceName,
      final_place_id: finalPlaceId,
      final_place_name: finalPlaceName,
      conflict,
    };
  }
}

const imageTextResolver = new ImageTextResolver();

module.exports = {
  ImageTextResolver,
  imageTextResolver,
  inferRewriteQuery,
};
