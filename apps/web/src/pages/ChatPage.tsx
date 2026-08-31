import { MessageSquarePlus } from "lucide-react";

import { ChatInput } from "../components/chat/ChatInput";
import { ChatWindow } from "../components/chat/ChatWindow";
import { useChat } from "../hooks/useChat";

export function ChatPage() {
  const { isSending, messages, newChat, sendMessage, sessionId } = useChat();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Travel AI Assistant</h1>
          <p>Session: {sessionId}</p>
        </div>
        <button type="button" className="new-chat-button" onClick={newChat}>
          <MessageSquarePlus aria-hidden="true" size={18} />
          <span>New chat</span>
        </button>
      </header>

      <div className="chat-layout">
        <ChatWindow
          isSending={isSending}
          messages={messages}
          onSuggestedQuestion={(question) => {
            void sendMessage({
              message: question,
              image: null,
              imagePreviewUrl: null,
            });
          }}
        />
        <ChatInput disabled={isSending} onSubmit={sendMessage} />
      </div>
    </main>
  );
}
