# FRONTEND_ARCHITECTURE.md

## Nên tách Frontend ra file riêng hay viết chung?

Nên tách **Frontend thành một file riêng** thay vì viết lẫn vào 3 file kiến trúc backend.

Lý do:

- 3 file JSON kiến trúc nên tập trung vào 3 luồng xử lý backend/RAG:
  - Text only
  - Image only
  - Text + Image
- Frontend không thay đổi quá nhiều theo từng luồng. Frontend chủ yếu gọi chung `POST /api/chat` và render theo `status`, `data.answer`, `data.location`, `data.images`, `suggested_questions`.
- Nếu nhét FE vào từng file kiến trúc, nội dung sẽ bị lặp lại rất nhiều.
- Khi vibe code, nên đưa AI coding tool file FE riêng để sinh UI rõ ràng hơn.

## Vai trò Frontend

Frontend là lớp giao diện ReactTS dùng để:

```txt
User nhập text / upload ảnh
    ↓
ChatInput tạo FormData
    ↓
Gọi POST /api/chat
    ↓
Nhận ApiResponse
    ↓
Render theo status
```

## Công nghệ đề xuất

```txt
Frontend: ReactTS + Vite
State: Zustand hoặc React Context
HTTP Client: Axios
Styling: CSS module / TailwindCSS
Form upload: FormData multipart/form-data
Session: localStorage
```

## Cấu trúc thư mục đề xuất

```txt
apps/web/src/
├── main.tsx
├── App.tsx
├── api/
│   ├── axiosClient.ts
│   ├── chatApi.ts
│   ├── locationApi.ts
│   └── imageApi.ts
├── types/
│   ├── api.types.ts
│   ├── chat.types.ts
│   ├── location.types.ts
│   ├── image.types.ts
│   ├── metadata.types.ts
│   └── debug.types.ts
├── pages/
│   ├── ChatPage.tsx
│   ├── HomePage.tsx
│   └── LocationDetailPage.tsx
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── ChatInput.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── UserMessage.tsx
│   │   ├── BotMessage.tsx
│   │   ├── ImageUploadBox.tsx
│   │   ├── UploadedImagePreview.tsx
│   │   ├── TypingIndicator.tsx
│   │   └── SuggestedQuestions.tsx
│   ├── location/
│   │   ├── LocationCard.tsx
│   │   ├── LocationInfoPanel.tsx
│   │   ├── LocationMetadata.tsx
│   │   ├── LocationTags.tsx
│   │   └── LocationDetail.tsx
│   ├── images/
│   │   ├── ImageGallery.tsx
│   │   ├── ImageCard.tsx
│   │   └── ImagePreviewModal.tsx
│   ├── common/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Loading.tsx
│   │   ├── ErrorMessage.tsx
│   │   ├── EmptyState.tsx
│   │   └── WarningMessage.tsx
│   └── debug/
│       ├── RetrievalDebugPanel.tsx
│       └── PipelineDebugPanel.tsx
├── hooks/
│   ├── useChat.ts
│   ├── useImageUpload.ts
│   ├── useSession.ts
│   └── useScrollToBottom.ts
├── store/
│   ├── chatStore.ts
│   ├── sessionStore.ts
│   └── uiStore.ts
├── utils/
│   ├── formatMessage.ts
│   ├── formatScore.ts
│   ├── validateImage.ts
│   ├── buildFormData.ts
│   └── constants.ts
└── styles/
    ├── chat.css
    └── layout.css
```

## API gọi từ Frontend

```ts
const formData = new FormData();

formData.append("session_id", sessionId);

if (message) {
  formData.append("message", message);
}

if (imageFile) {
  formData.append("image", imageFile);
}

const res = await axiosClient.post("/api/chat", formData, {
  headers: {
    "Content-Type": "multipart/form-data",
  },
});
```

## Render theo status

```txt
status = ok
    Render BotMessage + LocationInfoPanel + ImageGallery + SuggestedQuestions

status = out_of_scope
    Render WarningMessage + SuggestedQuestions

status = need_clarification
    Render BotMessage yêu cầu user nhập rõ địa điểm hơn

status = low_confidence
    Render candidate_locations nếu backend trả về

status = not_found
    Render EmptyState hoặc NotFoundMessage

status = error
    Render ErrorMessage
```

## Mapping response sang component

```txt
data.answer.text              -> BotMessage
data.location                 -> LocationInfoPanel
data.location.tags            -> LocationTags
data.images                   -> ImageGallery
data.images[i]                -> ImageCard
data.suggested_questions      -> SuggestedQuestions
data.debug                    -> PipelineDebugPanel
data.retrieval                -> RetrievalDebugPanel
message                       -> WarningMessage / BotMessage
status                        -> Message style
session_id                    -> sessionStore / localStorage
```

## Gợi ý cách dùng khi vibe code

Nên đưa AI coding tool theo thứ tự:

```txt
1. FRONTEND_ARCHITECTURE.md
2. API response contract
3. Một response mẫu status=ok
4. Một response mẫu out_of_scope
5. Yêu cầu code ChatPage trước
6. Sau khi ChatPage chạy được mới code LocationDetailPage và DebugPanel
```

## Nguyên tắc quan trọng

```txt
- Frontend không tự suy luận logic RAG.
- Frontend chỉ render theo response contract backend trả về.
- Không gọi Qdrant/Gemini/S3 trực tiếp từ frontend.
- Không lưu API key ở frontend.
- Mỗi lần gửi request phải kèm session_id.
- Nếu user bấm New chat thì tạo session_id mới.
```
