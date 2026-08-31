# BÁO CÁO ĐỒ ÁN / THỰC TẬP TỐT NGHIỆP: TRAVEL AI ASSISTANT

**TRƯỜNG ĐẠI HỌC QUY NHƠN — KHOA CÔNG NGHỆ THÔNG TIN**  
**Hệ thống Trợ lý Du lịch AI Đa phương thức (Multimodal RAG)**

---

## CHƯƠNG 4: PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG

Chương này trình bày phần phân tích yêu cầu và thiết kế hệ thống cho ứng dụng Travel AI Assistant. Nội dung gồm frontend ReactTS + Vite trong `apps/web` và backend NodeJS + Express trong `apps/api`. Trọng tâm của chương là cách hệ thống tiếp nhận yêu cầu từ người dùng, phân loại dữ liệu đầu vào, truy xuất dữ liệu từ Qdrant, sử dụng embedding model và Gemini LLM để tạo câu trả lời, đồng thời chuẩn hóa response trả về frontend.

Endpoint xử lý hội thoại chính là `POST /api/chat`. Backend hỗ trợ ba tình huống đầu vào: người dùng chỉ nhập văn bản, chỉ gửi hình ảnh, hoặc gửi cả văn bản kèm hình ảnh. Trong code, ba loại này lần lượt là `text_only`, `image_only` và `image_text`.

---

### 4.1. Yêu cầu chức năng

Yêu cầu chức năng của Travel AI Assistant xoay quanh mục tiêu hỗ trợ người dùng tra cứu thông tin du lịch bằng ngôn ngữ tự nhiên và hình ảnh:

1. **Hỏi đáp bằng văn bản (`text_only`)**:
   - Người dùng có thể hỏi tổng quan về địa điểm, vị trí địa lý, các hoạt động tham quan/vui chơi hoặc yêu cầu xem hình ảnh liên quan.
   - Frontend đóng gói message vào FormData và gửi đến `/api/chat`; backend phân loại là `text_only` rồi chuyển sang `TextOnlyPipeline` để xử lý.

2. **Tìm kiếm & nhận diện bằng hình ảnh (`image_only`)**:
   - Người dùng tải lên ảnh địa điểm du lịch để hệ thống tìm ảnh tương tự trong collection ảnh của Qdrant.
   - Backend dùng `multer.memoryStorage()` để nhận file vào bộ nhớ tạm thời, không lưu ảnh lâu dài trên ổ đĩa. Khi chỉ có ảnh và không có message, input_type là `image_only` và `ImageOnlyPipeline` sẽ xử lý.

3. **Hỏi đáp kết hợp văn bản và hình ảnh (`image_text`)**:
   - Người dùng có thể hỏi trực tiếp về bức ảnh (ví dụ: *"ở đây có gì chơi?"*), hoặc gửi ảnh một địa điểm nhưng hỏi về một địa điểm khác.
   - `ImageTextPipeline` vừa nhận diện địa điểm từ ảnh, vừa phân tích nội dung câu hỏi để xác định địa điểm cuối cùng cần truy xuất và xử lý xung đột nếu có.

4. **Sinh câu trả lời bám sát dữ liệu (Grounded Generation)**:
   - Hệ thống trả lời dựa trên dữ liệu truy xuất được, không để LLM trả lời tự do ngay từ đầu.
   - Backend lấy dữ liệu từ Qdrant thông qua `TextRepository`, `ImageRepository` và `LocationRepository`.
   - `AnswerGenerator` xây dựng prompt chứa retrieval JSON và yêu cầu Gemini trả lời bằng tiếng Việt, chỉ sử dụng dữ liệu đã truy xuất. Nếu dữ liệu chưa đủ, hệ thống thông báo chưa có đủ dữ liệu thay vì bịa thông tin (hallucination).

5. **Gợi ý câu hỏi thông minh (`suggested_questions`)**:
   - Các pipeline tạo danh sách câu hỏi gợi ý tiếp theo dựa trên `locationName`, giúp duy trì cuộc trò chuyện tự nhiên.

---

### 4.2. Yêu cầu phi chức năng

- **Dễ mở rộng**: Backend phân tách thành các tầng chuyên biệt: Controller, Service, Repository, Pipeline, Guard, LLM, Embeddings và Config. Khi cần thêm luồng xử lý mới, chỉ cần bổ sung pipeline mới.
- **Dễ bảo trì**: Áp dụng mô hình Service + Repository. Repository tập trung tương tác với Qdrant, còn Service xử lý nghiệp vụ.
- **Phản hồi rõ ràng (Response Contract)**: Chuẩn hóa qua `responseFormatter.js`. Mọi response đều có cấu trúc: `success`, `status`, `error_code`, `message`, `data`, và `suggested_questions`.
- **Hạn chế bịa thông tin**: Kiểm soát chặt chẽ prompt của Gemini và từ chối sinh nội dung khi dữ liệu retrieval rỗng.
- **Khả năng cấu hình cao**: Đọc cấu hình từ biến môi trường qua `env.js` (Port, Prefix, Qdrant URL, Gemini Keys, Thresholds...).

---

### 4.3. Kiến trúc tổng thể hệ thống

| Lớp kiến trúc | Thành phần chính trong dự án | Vai trò |
| :--- | :--- | :--- |
| **Frontend** | `apps/web` (ReactTS + Vite), `ChatPage`, `ChatInput`, `ImageGallery`, `LocationInfoPanel` | Nhận input từ người dùng, gửi FormData, hiển thị ApiResponse |
| **API / Controller** | `app.js`, `ChatController` | Khai báo endpoint, tiếp nhận request, điều phối pipeline |
| **Service / Pipeline** | `InputRouterService`, `ContextService`, `TextOnlyPipeline`, `ImageOnlyPipeline`, `ImageTextPipeline` | Xử lý logic nghiệp vụ và điều phối Retrieval / AI LLM |
| **Repository** | `TextRepository`, `ImageRepository`, `LocationRepository` | Tương tác và truy vấn dữ liệu từ Qdrant External |
| **AI Model Layer** | `GeminiClient`, `BgeM3EmbeddingService`, `ImageEmbeddingService`, `SiglipTextEmbeddingService` | Hiểu ngôn ngữ tự nhiên, tạo embedding vector, sinh câu trả lời |
| **External Storage** | Qdrant Cloud/Server, Amazon S3 | Lưu trữ vector database và cung cấp URL hình ảnh |

---

### 4.4. Thiết kế luồng xử lý Request

1. Frontend gọi `sendChatMessage()` tạo FormData gửi tới `POST /api/chat`.
2. Multer đọc file ảnh vào `req.file` trong RAM.
3. `ChatController.handle` gọi `InputRouterService.route()`.
4. `InputRouterService` trả về `session_id`, `input_type`, `message` và `image_summary`.
5. Nếu `empty_input` $\rightarrow$ Trả `EMPTY_INPUT` (HTTP 400).
6. Nếu `text_only` $\rightarrow$ Chuyển `TextOnlyPipeline.run()`.
7. Nếu `image_only` $\rightarrow$ Chuyển `ImageOnlyPipeline.run()`.
8. Nếu `image_text` $\rightarrow$ Chuyển `ImageTextPipeline.run()`.
9. Pipeline trả về `{ statusCode, body }` để Controller gửi response JSON.

---

### 4.5. Thiết kế Response Contract

| Trường | Kiểu dữ liệu | Ý nghĩa |
| :--- | :--- | :--- |
| `success` | `boolean` | `true` nếu request được xử lý thành công theo nghiệp vụ; `false` nếu có lỗi |
| `status` | `string` | Trạng thái: `ok`, `error`, `out_of_scope`, `need_clarification`, `low_confidence` |
| `error_code` | `string \| null` | Mã lỗi định danh (VD: `EMPTY_INPUT`, `LOW_CONFIDENCE_MATCH`...) |
| `message` | `string` | Thông báo ngắn gọn cho UI / Debug |
| `data` | `object` | Dữ liệu chính: `answer`, `location`, `images`, `retrieval`, `debug` |
| `suggested_questions`| `string[]` | Danh sách câu hỏi gợi ý tiếp theo |

---

### 4.6. Thiết kế 3 luồng xử lý chính

#### 4.6.1. Luồng `text_only`
- **Mục tiêu**: Hiểu câu hỏi văn bản, tìm kiếm tài liệu/hình ảnh tương ứng trong Qdrant và sinh câu trả lời.
- **Quy trình**:
  - `TextDomainGuard`: Chặn câu hỏi ngoài phạm vi du lịch.
  - `TextUnderstandingService`: Dùng Gemini phân tích `rewrite_query`, `intent`, `need_docs`, `need_images`, `need_metadata`.
  - `ReferenceResolver`: Bổ sung thông tin ngữ cảnh nếu là câu hỏi tiếp nối.
  - `RetrievalPlanner`: Lên kế hoạch tìm kiếm.
  - `BgeM3EmbeddingService` + `TextRepository`: Tìm kiếm văn bản trong `text_collection` (`text_vector`).
  - `SiglipTextEmbeddingService` + `ImageRepository`: Tìm kiếm ảnh qua **Hybrid Search** (`image_vector` 0.3 + `caption_vector` 0.7) trong `image_collection`.
  - `LocationRepository`: Lấy metadata từ `location_info`.
  - `FusionService` + `AnswerGenerator`: Gom dữ liệu và dùng Gemini tạo câu trả lời.

#### 4.6.2. Luồng `image_only`
- **Mục tiêu**: Nhận diện địa điểm từ ảnh tải lên và cung cấp thông tin tổng quan.
- **Quy trình**:
  - `ImageEmbeddingService`: Tạo vector ảnh 768 chiều bằng SigLIP.
  - `ImageRepository.searchImagesByImageVector`: Tìm kiếm ảnh tương đồng trong `image_collection`.
  - `ConfidenceGuard`: Kiểm tra ngưỡng tương đồng `imageMatchThreshold`. Nếu thấp $\rightarrow$ Trả `LOW_CONFIDENCE_MATCH`.
  - Sử dụng default query: *"Đây là địa điểm nào và thông tin tổng quan là gì?"*.
  - `TextRepository`: Truy xuất tài liệu tương ứng theo `location_id`.
  - `AnswerGenerator`: Dùng Gemini sinh câu trả lời tổng quan.

#### 4.6.3. Luồng `image_text`
- **Mục tiêu**: Kết hợp thông tin từ ảnh và câu hỏi văn bản, nhận diện xung đột nếu có.
- **Quy trình**:
  - SigLIP tạo vector ảnh $\rightarrow$ Tìm `imagePlace` trong `image_collection`.
  - `ImageTextUnderstandingService`: Dùng Gemini phân tích mối quan hệ giữa câu hỏi và địa điểm trong ảnh.
  - `ImageTextResolver`: Xác định `final_place_id`. Nếu ảnh là địa điểm A nhưng câu hỏi nói về địa điểm B $\rightarrow$ Tạo `conflict_type = "image_text_place_mismatch"`.
  - Truy xuất tài liệu, ảnh liên quan (Hybrid Search SigLIP 0.5 + Caption 0.5) và metadata.
  - `AnswerGenerator`: Sinh câu trả lời giải quyết rõ ràng tình huống xung đột.

---

### 4.7. Thiết kế Context hội thoại
- Quản lý bởi `ContextService` (`src/services/context.service.js`) lưu trữ trong memory `Map` theo `session_id`.
- Các trường context chính:
  - `old_input`: Câu hỏi gốc trước đó.
  - `old_rewrite_query`: Query đã được viết lại.
  - `active_location_id` / `active_location_name`: Địa điểm đang là ngữ cảnh chính.
  - `last_returned_images`: Danh sách ảnh trả về gần nhất.
  - `last_image_place_id`, `last_text_place_id`, `last_conflict`: Thông tin nhận diện và xung đột gần nhất.

---

## CHƯƠNG 5: XÂY DỰNG BACKEND

Backend được triển khai trong thư mục `apps/api` với kiến trúc module hóa:

### 5.1. Cấu trúc Backend & Công nghệ
- **Nền tảng**: Node.js & Express (Pure JavaScript / ES Modules).
- **Điểm khởi chạy**: `src/server.js` lắng nghe trên cổng cấu hình (mặc định 8000).
- **Ứng dụng chính**: `src/app.js` tích hợp `cors`, `express.json()`, `multer.memoryStorage()`.

### 5.2. Các Service nghiệp vụ chính
- `InputRouterService`: Phân loại 4 kiểu input (`text_only`, `image_only`, `image_text`, `empty_input`).
- `TextUnderstandingService` & `ImageTextUnderstandingService`: Gọi Gemini trích xuất JSON Schema nghiêm ngặt.
- `ContextService`: Quản lý session hội thoại trong bộ nhớ.
- `FusionService`: Gom toàn bộ dữ liệu truy xuất thành context chuẩn bị cho LLM.
- `AnswerGenerator`: Prompt engineering với Gemini sinh câu trả lời tiếng Việt dựa trên retrieval context.

### 5.3. Tầng Repository & Qdrant
- `TextRepository`: Tìm kiếm văn bản trên `text_collection` (`text_vector`, BGE-M3 1024-dim).
- `ImageRepository`: Tìm kiếm ảnh trên `image_collection` (`image_vector` 768-dim, `caption_vector` 1024-dim, Hybrid Search).
- `LocationRepository`: Lấy metadata từ `location_info`.
- `QdrantClient`: Wrapper kết nối REST API Qdrant và chuẩn hóa mã lỗi (`QdrantConnectionError`, `QdrantSearchError`...).

### 5.4. Tích hợp AI & Storage
- **Embedding Models**: Chạy trực tiếp qua `@huggingface/transformers` với ONNX runtime:
  - `onnx-community/bge-m3-ONNX` (Text embedding).
  - `Xenova/siglip-base-patch16-384` (Image & Text-to-Image embedding).
- **Gemini LLM**: `GeminiClient` hỗ trợ xoay vòng nhiều API keys (`GEMINI_API_KEYS`) tránh nghẽn quota.
- **S3 Service**: Tự động phân tích `s3_path` thành `image_url` công khai hoặc presigned URL cho frontend.

---

## KẾT LUẬN & ĐỊNH HƯỚNG PHÁT TRIỂN

### 1. Kết quả đạt được
- Xây dựng thành công hệ thống **Multimodal RAG** hoàn chỉnh cho bài toán du lịch.
- Tích hợp trơn tru giữa Frontend ReactTS, Backend Node.js Express, Vector DB Qdrant, SigLIP, BGE-M3 và Gemini LLM.
- Xử lý được 3 luồng dữ liệu phức tạp (`text_only`, `image_only`, `image_text`) với cơ chế giải quyết xung đột thông minh.

### 2. Hạn chế & Hướng nâng cấp
- **Lưu trữ Session**: Hiện tại Context lưu trong RAM $\rightarrow$ Cần chuyển sang Redis hoặc CSDL quan hệ để duy trì lâu dài.
- **Tối ưu hóa Embedding**: Chạy mô hình ONNX trong Node.js CPU có thể chậm khi tải lần đầu $\rightarrow$ Có thể tách thành Microservice riêng (Python FastAPI / GPU server).
- **Độ tin cậy của JSON Output**: Cần thêm cơ chế retry / auto-fix khi LLM trả về JSON không đúng schema.
