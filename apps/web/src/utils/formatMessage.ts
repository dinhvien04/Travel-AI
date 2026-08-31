export function getResponseText(message?: string | null, fallback = "") {
  return message?.trim() || fallback;
}
