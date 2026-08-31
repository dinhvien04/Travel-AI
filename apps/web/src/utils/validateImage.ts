import { MAX_IMAGE_SIZE_BYTES, SUPPORTED_IMAGE_TYPES } from "./constants";

export function validateImage(file: File) {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    return "Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.";
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return "Ảnh vượt quá 8MB.";
  }

  return null;
}
