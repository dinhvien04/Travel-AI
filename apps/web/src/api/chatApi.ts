import { axiosClient } from "./axiosClient";
import type { ApiResponse, ChatResponseData } from "../types/api.types";
import type { SendChatPayload } from "../types/chat.types";

export async function sendChatMessage(payload: SendChatPayload) {
  const formData = new FormData();

  formData.append("session_id", payload.sessionId);

  if (payload.message?.trim()) {
    formData.append("message", payload.message.trim());
  }

  if (payload.image) {
    formData.append("image", payload.image);
  }

  const response = await axiosClient.post<ApiResponse<ChatResponseData>>(
    "/api/chat",
    formData,
  );

  return response.data;
}
