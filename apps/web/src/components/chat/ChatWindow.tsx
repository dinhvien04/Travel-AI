import type { ChatMessage } from "../../types/chat.types";
import { useScrollToBottom } from "../../hooks/useScrollToBottom";
import { BotMessage } from "./BotMessage";
import { UserMessage } from "./UserMessage";

type ChatWindowProps = {
  isSending?: boolean;
  messages: ChatMessage[];
  onSuggestedQuestion?: (question: string) => void;
};

export function ChatWindow({
  isSending = false,
  messages,
  onSuggestedQuestion,
}: ChatWindowProps) {
  const bottomRef = useScrollToBottom(messages.length + Number(isSending));

  if (!messages.length) {
    return (
      <section className="chat-window chat-window-empty">
        <div className="empty-state">
          <h2>Travel AI Assistant</h2>
          <p>Nhập câu hỏi, gửi ảnh địa điểm hoặc kết hợp cả hai để bắt đầu.</p>
        </div>
        <div ref={bottomRef} />
      </section>
    );
  }

  return (
    <section className="chat-window" aria-live="polite">
      {messages.map((message) =>
        message.role === "user" ? (
          <UserMessage key={message.id} message={message} />
        ) : (
          <BotMessage
            key={message.id}
            response={message.response}
            onSuggestedQuestion={onSuggestedQuestion}
          />
        ),
      )}
      {isSending ? (
        <div className="message-row message-row-bot">
          <div className="message-bubble bot-bubble typing">Đang xử lý...</div>
        </div>
      ) : null}
      <div ref={bottomRef} />
    </section>
  );
}
