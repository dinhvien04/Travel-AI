const { normalizeText } = require("../utils/text");

function parseImageRank(normalizedMessage) {
  if (normalizedMessage.includes("anh thu hai") || normalizedMessage.includes("hinh thu hai")) {
    return 2;
  }

  if (normalizedMessage.includes("anh thu nhat") || normalizedMessage.includes("hinh thu nhat")) {
    return 1;
  }

  const match = normalizedMessage.match(/(?:anh|hinh) thu (\d+)/);
  return match ? Number(match[1]) : null;
}

class ReferenceResolver {
  resolve({ message, understanding, context = {} }) {
    const normalized = normalizeText(message);
    const next = { ...understanding };
    const imageRank = parseImageRank(normalized);

    if (imageRank && Array.isArray(context.last_returned_images)) {
      const image = context.last_returned_images.find((item) => item.rank === imageRank);

      if (image) {
        next.location_id = next.location_id || image.location_id || null;
        next.location_name = next.location_name || image.location_name || null;
        next.rewrite_query = image.location_name
          ? `${image.location_name} ở đâu?`
          : `Địa điểm trong ảnh thứ ${imageRank} là ở đâu?`;
        next.need_docs = false;
        next.need_images = false;
        next.need_metadata = true;
        next.intent = "metadata";
        next.is_follow_up = true;
        return next;
      }
    }

    if (!next.location_id && context.active_location_id && next.is_follow_up) {
      next.location_id = context.active_location_id;
    }

    if (!next.location_name && context.active_location_name && next.is_follow_up) {
      next.location_name = context.active_location_name;
    }

    if (next.is_follow_up && next.location_name && !next.rewrite_query.includes(next.location_name)) {
      next.rewrite_query = `${next.location_name}: ${message}`;
    }

    return next;
  }
}

const referenceResolver = new ReferenceResolver();

module.exports = {
  ReferenceResolver,
  parseImageRank,
  referenceResolver,
};
