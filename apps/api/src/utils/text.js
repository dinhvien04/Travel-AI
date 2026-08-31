function removeVietnameseDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function normalizeText(value) {
  return removeVietnameseDiacritics(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function includesAny(normalizedText, keywords) {
  return keywords.some((keyword) => normalizedText.includes(keyword));
}

module.exports = {
  includesAny,
  normalizeText,
  removeVietnameseDiacritics,
};
