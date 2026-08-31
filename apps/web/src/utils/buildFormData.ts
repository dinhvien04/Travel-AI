export function buildFormData(fields: Record<string, string | Blob | null | undefined>) {
  const formData = new FormData();

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      formData.append(key, value);
    }
  });

  return formData;
}
