import type { ApiResponse, ChatResponseData } from "../../types/api.types";
import { ErrorMessage } from "../common/ErrorMessage";
import { ImageGallery } from "../images/ImageGallery";
import { LocationInfoPanel } from "../location/LocationInfoPanel";
import { MessageBubble } from "./MessageBubble";
import { SuggestedQuestions } from "./SuggestedQuestions";

type BotMessageProps = {
  response: ApiResponse<ChatResponseData>;
  onSuggestedQuestion?: (question: string) => void;
};

function getSuggestedQuestions(response: ApiResponse<ChatResponseData>) {
  return response.suggested_questions?.length
    ? response.suggested_questions
    : response.data?.suggested_questions || [];
}

function AnswerText({ text }: { text?: string | null }) {
  if (!text) {
    return null;
  }

  return <p className="answer-text">{text}</p>;
}

export function BotMessage({ onSuggestedQuestion, response }: BotMessageProps) {
  const data = response.data;
  const suggestions = getSuggestedQuestions(response);
  const answerText = data?.answer?.text || response.message;
  const status = response.status;

  return (
    <MessageBubble role="bot">
      <div className={`message-bubble bot-bubble bot-status-${status}`}>
        {status === "ok" ? (
          <>
            <AnswerText text={answerText} />
            <LocationInfoPanel location={data?.location} />
            <ImageGallery images={data?.images} />
          </>
        ) : null}

        {status === "out_of_scope" ? (
          <ErrorMessage
            tone="warning"
            title="Ngoài phạm vi hỗ trợ"
            message={response.message || "Yêu cầu này chưa thuộc phạm vi du lịch."}
          />
        ) : null}

        {status === "need_clarification" ? (
          <ErrorMessage
            tone="info"
            title="Cần làm rõ"
            message={response.message || "Bạn hãy nhập rõ hơn địa điểm hoặc nhu cầu."}
          />
        ) : null}

        {status === "low_confidence" ? (
          <>
            <ErrorMessage
              tone="warning"
              title="Độ tin cậy thấp"
              message={
                response.message ||
                "Backend tìm thấy một vài kết quả có thể liên quan nhưng chưa đủ chắc chắn."
              }
            />
            <ImageGallery
              images={data?.candidate_locations || data?.images}
              title="Ứng viên gần đúng"
            />
          </>
        ) : null}

        {status === "error" ? (
          <ErrorMessage
            tone="error"
            title={response.error_code || "Lỗi"}
            message={response.message || "Không thể xử lý yêu cầu."}
          />
        ) : null}

        {!["ok", "out_of_scope", "need_clarification", "low_confidence", "error"].includes(
          String(status),
        ) ? (
          <ErrorMessage
            tone="info"
            title={`Trạng thái ${status}`}
            message={response.message || "Backend trả về trạng thái chưa được định nghĩa."}
          />
        ) : null}

        <SuggestedQuestions questions={suggestions} onSelect={onSuggestedQuestion} />
      </div>
    </MessageBubble>
  );
}
