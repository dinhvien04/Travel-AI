type SuggestedQuestionsProps = {
  questions?: string[];
  onSelect?: (question: string) => void;
};

export function SuggestedQuestions({
  onSelect,
  questions = [],
}: SuggestedQuestionsProps) {
  if (!questions.length) {
    return null;
  }

  return (
    <div className="suggested-questions" aria-label="Câu hỏi gợi ý">
      {questions.map((question) => (
        <button key={question} type="button" onClick={() => onSelect?.(question)}>
          {question}
        </button>
      ))}
    </div>
  );
}
