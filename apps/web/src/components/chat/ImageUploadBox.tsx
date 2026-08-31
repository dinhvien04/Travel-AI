import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

type ImageUploadBoxProps = {
  error?: string | null;
  imageFile?: File | null;
  onClear: () => void;
  onSelect: (file: File | null) => void;
  previewUrl?: string | null;
};

export function ImageUploadBox({
  error,
  imageFile,
  onClear,
  onSelect,
  previewUrl,
}: ImageUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSelect(event.target.files?.[0] || null);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    onSelect(event.dataTransfer.files?.[0] || null);
  };

  return (
    <div className="upload-area">
      {previewUrl && imageFile ? (
        <div className="upload-preview">
          <img src={previewUrl} alt={imageFile.name} />
          <div>
            <strong>{imageFile.name}</strong>
            <span>{Math.round(imageFile.size / 1024)} KB</span>
          </div>
          <button type="button" onClick={onClear} aria-label="Bỏ ảnh đã chọn">
            <X aria-hidden="true" size={17} />
          </button>
        </div>
      ) : (
        <div
          className={`upload-dropzone ${isDragging ? "is-dragging" : ""}`}
          onClick={openPicker}
          onDragLeave={() => setIsDragging(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              openPicker();
            }
          }}
        >
          <ImagePlus aria-hidden="true" size={18} />
          <span>Chọn ảnh</span>
        </div>
      )}
      <input
        ref={inputRef}
        accept="image/jpeg,image/png,image/webp"
        hidden
        type="file"
        onChange={handleInputChange}
      />
      {error ? <p className="upload-error">{error}</p> : null}
    </div>
  );
}
