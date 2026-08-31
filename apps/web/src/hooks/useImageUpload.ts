import { useCallback, useEffect, useState } from "react";

import { validateImage } from "../utils/validateImage";

export function useImageUpload() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectImage = useCallback((file: File | null) => {
    setError(null);

    if (!file) {
      setImageFile(null);
      return;
    }

    const validationError = validateImage(file);

    if (validationError) {
      setError(validationError);
      setImageFile(null);
      return;
    }

    setImageFile(file);
  }, []);

  const clearImage = useCallback(() => {
    setImageFile(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(imageFile);

    setPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [imageFile]);

  return {
    clearImage,
    error,
    imageFile,
    previewUrl,
    selectImage,
  };
}
