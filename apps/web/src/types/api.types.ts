import type { ImageItem } from "./image.types";
import type { LocationInfo } from "./location.types";

export type ApiStatus =
  | "ok"
  | "out_of_scope"
  | "need_clarification"
  | "low_confidence"
  | "error";

export type ApiResponse<TData = unknown> = {
  success: boolean;
  status: ApiStatus | string;
  error_code: string | null;
  message: string | null;
  data: TData | null;
  suggested_questions: string[];
};

export type AnswerContent = {
  text?: string | null;
  markdown?: boolean;
};

export type ChatResponseData = {
  session_id?: string | null;
  input_type?: string | null;
  pipeline?: string | null;
  answer?: AnswerContent | null;
  location?: LocationInfo | null;
  images?: ImageItem[];
  matched_image?: ImageItem | null;
  candidate_locations?: ImageItem[];
  retrieval?: Record<string, unknown> | null;
  debug?: Record<string, unknown> | null;
  suggested_questions?: string[];
};
