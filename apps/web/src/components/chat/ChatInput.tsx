import { FormEvent, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";

import { useImageUpload } from "../../hooks/useImageUpload";
import { ImageUploadBox } from "./ImageUploadBox";

type ChatInputProps = {
  disabled?: boolean;
  onSubmit: (payload: {
    message: string;
    image: File | null;
    imagePreviewUrl: string | null;
  }) => Promise<void> | void;
};

export function ChatInput({ disabled = false, onSubmit }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const { clearImage, error, imageFile, previewUrl, selectImage } = useImageUpload();
  const canSubmit = Boolean(message.trim() || imageFile) && !disabled;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    await onSubmit({
      message,
      image: imageFile,
      imagePreviewUrl: previewUrl,
    });

    setMessage("");
    clearImage();
  };

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <div className="composer-row">
        <ImageUploadBox
          error={error}
          imageFile={imageFile}
          onClear={clearImage}
          onSelect={selectImage}
          previewUrl={previewUrl}
        />
        <textarea
          value={message}
          placeholder="Hỏi về địa điểm, hoạt động hoặc gửi ảnh để nhận diện..."
          rows={2}
          disabled={disabled}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="composer-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              setMessage("");
              clearImage();
            }}
            aria-label="Xóa nội dung đang nhập"
            disabled={disabled || (!message && !imageFile)}
          >
            <Trash2 aria-hidden="true" size={18} />
          </button>
          <button className="send-button" type="submit" disabled={!canSubmit}>
            {disabled ? (
              <Loader2 aria-hidden="true" className="spin" size={18} />
            ) : (
              <Send aria-hidden="true" size={18} />
            )}
            <span>Gửi</span>
          </button>
        </div>
      </div>
    </form>
  );
}
