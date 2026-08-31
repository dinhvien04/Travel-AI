import type { UserChatMessage } from "../../types/chat.types";
import { MessageBubble } from "./MessageBubble";

type UserMessageProps = {
  message: UserChatMessage;
};

export function UserMessage({ message }: UserMessageProps) {
  return (
    <MessageBubble role="user">
      <div className="message-bubble user-bubble">
        {message.imagePreviewUrl ? (
          <img
            className="uploaded-preview"
            src={message.imagePreviewUrl}
            alt={message.imageName || "Ảnh đã tải lên"}
          />
        ) : null}
        {message.text ? <p>{message.text}</p> : null}
      </div>
    </MessageBubble>
  );
}
