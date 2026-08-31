import { useCallback, useMemo, useState } from "react";
import axios from "axios";

import { sendChatMessage } from "../api/chatApi";
import type { ApiResponse, ChatResponseData } from "../types/api.types";
import type { ChatMessage } from "../types/chat.types";
import { useSession } from "./useSession";

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTransportErrorResponse(message: string): ApiResponse<ChatResponseData> {
  return {
    success: false,
    status: "error",
    error_code: "FRONTEND_REQUEST_ERROR",
    message,
    data: null,
    suggested_questions: [],
  };
}

export function useChat() {
  const { resetSession, sessionId } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  const sendMessage = useCallback(
    async ({
      message,
      image,
      imagePreviewUrl,
    }: {
      message?: string;
      image?: File | null;
      imagePreviewUrl?: string | null;
    }) => {
      const text = message?.trim() || "";

      if (!text && !image) {
        return;
      }

      const userMessage: ChatMessage = {
        id: createMessageId("user"),
        role: "user",
        text,
        imagePreviewUrl: imagePreviewUrl || undefined,
        imageName: image?.name,
        createdAt: new Date().toISOString(),
      };

      setMessages((current) => [...current, userMessage]);
      setIsSending(true);

      try {
        const response = await sendChatMessage({
          sessionId,
          message: text,
          image,
        });
        const botMessage: ChatMessage = {
          id: createMessageId("bot"),
          role: "bot",
          response,
          createdAt: new Date().toISOString(),
        };

        setMessages((current) => [...current, botMessage]);
      } catch (error) {
        const messageText = axios.isAxiosError(error)
          ? error.response?.data?.message || error.message
          : "Không thể gửi yêu cầu tới backend.";
        const botMessage: ChatMessage = {
          id: createMessageId("bot-error"),
          role: "bot",
          response: createTransportErrorResponse(messageText),
          createdAt: new Date().toISOString(),
        };

        setMessages((current) => [...current, botMessage]);
      } finally {
        setIsSending(false);
      }
    },
    [sessionId],
  );

  const newChat = useCallback(() => {
    resetSession();
    setMessages([]);
  }, [resetSession]);

  return useMemo(
    () => ({
      isSending,
      messages,
      newChat,
      sendMessage,
      sessionId,
    }),
    [isSending, messages, newChat, sendMessage, sessionId],
  );
}
