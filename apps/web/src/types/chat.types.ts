import type { ApiResponse, ChatResponseData } from "./api.types";

export type ChatRole = "user" | "bot";

export type UserChatMessage = {
  id: string;
  role: "user";
  text: string;
  imagePreviewUrl?: string;
  imageName?: string;
  createdAt: string;
};

export type BotChatMessage = {
  id: string;
  role: "bot";
  response: ApiResponse<ChatResponseData>;
  createdAt: string;
};

export type ChatMessage = UserChatMessage | BotChatMessage;

export type SendChatPayload = {
  sessionId: string;
  message?: string;
  image?: File | null;
};
