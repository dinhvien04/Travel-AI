# MÔ TẢ LUỒNG HOẠT ĐỘNG HỆ THỐNG TRAVEL AI ASSISTANT

> **Tài liệu kỹ thuật Backend theo source code hiện tại**  
> **Phạm vi**: Mô tả chi tiết luồng xử lý của endpoint `POST /api/chat` với ba nhánh: `text_only`, `image_only`, và `text_image` (`image_text`).

---

## MỤC LỤC
1. [Tổng quan kiến trúc xử lý Request](#1-tổng-quan-kiến-trúc-xử-lý-request)
2. [Luồng `text_only`](#2-luồng-text_only)
3. [Luồng `image_only`](#3-luồng-image_only)
4. [Luồng `text_image` (`image_text`)](#4-luồng-text_image-image_text)
5. [Ghi chú về phần chưa thấy rõ trong code](#5-ghi-chú-về-phần-chưa-thấy-rõ-trong-code)

---

## 1. TỔNG QUAN KIẾN TRÚC XỬ LÝ REQUEST

Backend được xây dựng bằng **NodeJS + Express (JavaScript thuần)**:
- `src/server.js`: Khởi động Express app theo `appConfig.port` và `appConfig.apiPrefix`.
- `src/app.js`: Khai báo trực tiếp endpoint `POST ${appConfig.apiPrefix}/chat` sử dụng middleware `multer.memoryStorage()` với `upload.single("image")`.

### 1.1. Luồng vào chung của `POST /api/chat`
1. **Client** gửi `multipart/form-data` tới `POST /api/chat` với các field:
   - `session_id`: ID phiên hội thoại.
   - `message`: Câu hỏi văn bản (nếu có).
   - `image`: File ảnh upload (nếu có).
2. **`app.js`** dùng multer nạp ảnh vào bộ nhớ tạm `req.file` (không lưu file dài hạn trên disk).
3. **`ChatController.handle`** (`src/controllers/chat.controller.js`) gọi `inputRouterService.route({ sessionId, message, image })`.
4. **`InputRouterService`** (`src/services/inputRouter.service.js`) chuẩn hóa message bằng `trim()`, kiểm tra sự tồn tại của message và image, rồi phân loại `input_type`.
5. Nếu không có cả message lẫn image, trả về `errorResponse` với mã lỗi `EMPTY_INPUT` (HTTP 400).
6. Điều phối sang Pipeline tương ứng:
   - `text_only` $\rightarrow$ `TextOnlyPipeline.run()`
   - `image_only` $\rightarrow$ `ImageOnlyPipeline.run()`
   - `image_text` $\rightarrow$ `ImageTextPipeline.run()`

| `input_type` | Điều kiện phân loại | Pipeline được gọi |
| :--- | :--- | :--- |
| **`text_only`** | Có `message` sau khi trim, không có `image` | `TextOnlyPipeline` (`src/pipelines/text-only.pipeline.js`) |
| **`image_only`** | Có `image`, không có `message` | `ImageOnlyPipeline` (`src/pipelines/image-only.pipeline.js`) |
| **`image_text`** | Có cả `message` và `image` | `ImageTextPipeline` (`src/pipelines/image-text.pipeline.js`) |
| **`empty_input`** | Không có `message` và không có `image` | Không gọi pipeline, trả `EMPTY_INPUT` (HTTP 400) |

> **Lưu ý đặt tên**: Tài liệu sử dụng thuật ngữ `text_image` để mô tả tương ứng với mã nguồn backend hiện tại đang định danh là `image_text`.

### 1.2. Response Contract chung
Mọi response trả về frontend đều tuân thủ cấu trúc chuẩn từ `src/utils/responseFormatter.js`:
- `success`: `boolean`
- `status`: `'ok'` | `'error'` | `'out_of_scope'` | `'need_clarification'` | `'low_confidence'`
- `error_code`: Mã lỗi định danh (VD: `EMPTY_INPUT`, `LOW_CONFIDENCE_MATCH`, `LLM_CLASSIFICATION_ERROR`...)
- `message`: Chuỗi thông báo
- `data`: Payload chi tiết (`answer`, `location`, `images`, `retrieval`, `debug`...)
- `suggested_questions`: Danh sách câu hỏi gợi ý

### 1.3. Cấu hình Qdrant & Embedding Models
| Nhóm | Tên trong code / Env | Giá trị / Cấu hình |
| :--- | :--- | :--- |
| **Location Collection** | `appConfig.qdrant.collections.location` | `location_info` |
| **Image Collection** | `appConfig.qdrant.collections.image` | `image_collection` |
| **Text Collection** | `appConfig.qdrant.collections.text` | `text_collection` |
| **Vector văn bản** | `TEXT_VECTOR_NAME` | `text_vector` (1024-dim, BGE-M3) |
| **Vector hình ảnh** | `IMAGE_VECTOR_NAME` | `image_vector` (768-dim, SigLIP) |
| **Vector caption ảnh** | `CAPTION_VECTOR_NAME` | `caption_vector` (1024-dim, BGE-M3) |
| **Text Embedding** | `BgeM3EmbeddingService` | `onnx-community/bge-m3-ONNX` (1024 dimensions) |
| **Vision & SigLIP Text** | `ImageEmbeddingService`, `SiglipTextEmbeddingService` | `Xenova/siglip-base-patch16-384` (768 dimensions) |
| **LLM Generator** | `GeminiClient` | Google Gemini API (Key Rotation qua `GEMINI_API_KEYS`) |

---

## 2. LUỒNG `text_only`

Luồng xử lý khi người dùng chỉ nhập câu hỏi văn bản (`input_type = "text_only"`).

### Các bước xử lý chi tiết:
1. `ChatController.handle` nhận `routeResult` và gọi `TextOnlyPipeline.run({ sessionId, message, inputType })`.
2. `TextOnlyPipeline` xác thực `inputType === 'text_only'`.
3. Lấy ngữ cảnh hội thoại qua `contextService.getContext(sessionId)`.
4. `TextDomainGuard.check(message, context)`: Kiểm tra từ khóa ngoài phạm vi (`OUT_OF_DOMAIN_KEYWORDS`). Nếu ngoài phạm vi du lịch $\rightarrow$ trả `outOfScopeResponse` với mã `TEXT_NOT_TRAVEL_RELATED`.
5. `TextUnderstandingService.understand({ message, context })`: Gọi Gemini LLM (`GeminiClient.generateJson`) trích xuất JSON theo schema:
   - `rewrite_query`: Câu hỏi đã viết lại rõ nghĩa
   - `need_docs`, `need_images`, `need_metadata`: Cờ truy xuất
   - `location_id`, `location_name`: Địa điểm nhận diện
   - `is_follow_up`: Có phải câu hỏi nối tiếp không
   - `intent`: `overview` | `activity` | `image_search` | `metadata` | `location_lookup` | `unknown`
6. `ReferenceResolver.resolve()`: Bổ sung `location_id` từ ngữ cảnh (nếu là câu hỏi tiếp nối hoặc tham chiếu ảnh trước đó).
7. `RetrievalPlanner.plan()`: Lập kế hoạch truy xuất (`shouldSearchDocs`, `shouldSearchImages`, `shouldGetMetadata`, `topKDocs`, `topKImages`).
8. **Truy xuất tài liệu** (nếu `shouldSearchDocs = true`):
   - Tạo vector bằng `bgeM3EmbeddingService.embedText(rewrite_query)`.
   - Tìm kiếm trong `text_collection` (`text_vector`), áp dụng filter `location_id` nếu có.
9. **Truy xuất hình ảnh (Hybrid Search)** (nếu `shouldSearchImages = true`):
   - Sinh vector SigLIP từ text qua `siglipTextEmbeddingService.embedText(rewrite_query)`.
   - Thực hiện **Hybrid Image Search** trên `image_collection`:
     - Nhánh 1: `image_vector` $\leftrightarrow$ SigLIP text vector (trọng số **0.3**).
     - Nhánh 2: `caption_vector` $\leftrightarrow$ BGE-M3 text vector (trọng số **0.7**).
   - Hợp nhất kết quả, tính điểm `final_score`, gắn URL S3 qua `s3Service.attachImageUrls()`.
10. **Truy xuất Metadata** (nếu `shouldGetMetadata = true`): Lấy thông tin từ `location_info` qua `locationRepository.getLocationById()`.
11. `FusionService.fuse()`: Tổng hợp `message`, `rewrite_query`, `docs`, `images`, `metadata` thành `fusedContext`.
12. `AnswerGenerator.generate()`: Dùng Gemini sinh câu trả lời tiếng Việt từ Retrieval JSON (nghiêm cấm bịa đặt thông tin ngoài context).
13. `contextService.updateOnSuccess()`: Cập nhật `old_input`, `old_rewrite_query`, `active_location_id`, `last_returned_images`...
14. Trả về `okResponse(data)` (HTTP 200).

---

## 3. LUỒNG `image_only`

Luồng xử lý khi người dùng tải lên một hình ảnh mà không nhập văn bản (`input_type = "image_only"`).

### Các bước xử lý chi tiết:
1. `ChatController.handle` gọi `ImageOnlyPipeline.run({ sessionId, inputType, image })`.
2. Kiểm tra tính hợp lệ của file ảnh (buffer tồn tại, `mimetype` bắt đầu bằng `image/`).
3. `ImageEmbeddingService.embedImage(image)`: Dùng SigLIP Vision Model (`siglip-base-patch16-384`) tạo image vector 768 chiều.
4. `ImageRepository.searchImagesByImageVector()`: Tìm kiếm ảnh tương đồng nhất trong `image_collection` (`image_vector`).
5. `S3Service.attachImageUrls()`: Chuyển `s3_path` thành `image_url` công khai hoặc presigned URL.
6. `ConfidenceGuard.checkImageMatch()`: Kiểm tra độ tin cậy dựa trên ngưỡng:
   - Nếu `top_score < imageMatchThreshold` $\rightarrow$ Trả `lowConfidenceResponse` với mã `LOW_CONFIDENCE_MATCH` kèm danh sách ảnh ứng viên.
   - Nếu không tìm thấy `location_id` $\rightarrow$ Trả lỗi `IMAGE_LOCATION_NOT_FOUND`.
7. `LocationRepository.getLocationById(locationId)`: Lấy metadata địa điểm từ `location_info`.
8. Sử dụng câu hỏi mặc định: `IMAGE_ONLY_DEFAULT_QUERY = "Đây là địa điểm nào và thông tin tổng quan là gì?"`.
9. `BgeM3EmbeddingService` tạo text vector cho câu hỏi mặc định $\rightarrow$ `TextRepository.searchDocsByTextVector()` tìm tài liệu mô tả địa điểm trong `text_collection` (filter theo `location_id`).
10. `FusionService.fuse()` gom metadata, tài liệu, ảnh match và debug info.
11. `AnswerGenerator.generate()` (intent: `overview`): Dùng Gemini tạo mô tả tổng quan về địa điểm đã nhận diện.
12. Sinh `suggested_questions` gợi ý các hoạt động, vị trí, trải nghiệm liên quan đến địa điểm.
13. Cập nhật context phiên làm việc và trả `okResponse(data)`.

---

## 4. LUỒNG `text_image` (`image_text`)

Luồng xử lý khi người dùng gửi đồng thời cả hình ảnh và câu hỏi văn bản (`input_type = "image_text"`).

### Các bước xử lý chi tiết:
1. `ChatController.handle` gọi `ImageTextPipeline.run({ sessionId, message, inputType, image })`.
2. Xác thực file ảnh hợp lệ (`validateUploadedImage`).
3. Lấy ngữ cảnh hiện tại và tạo `imageVector` (SigLIP 768-dim) từ ảnh upload.
4. Tìm kiếm ảnh tương đồng trong `image_collection` và gắn URL qua `S3Service`.
5. `evaluateImageConfidence()` phân loại độ tin cậy 2 cấp:
   - `topScore < imageLowConfidenceThreshold` (VD: < 0.25) $\rightarrow$ Trả `outOfScopeResponse` (`IMAGE_NOT_TRAVEL_RELATED`).
   - `topScore < imageMatchThreshold` (VD: < 0.75) $\rightarrow$ Trả `lowConfidenceResponse` (`LOW_CONFIDENCE_MATCH`).
6. Lấy `imagePlace` (`location_id`, `location_name`) từ ảnh match tốt nhất, cập nhật vào `imageContext`.
7. `TextDomainGuard.check(message, imageContext)` kiểm tra câu hỏi văn bản.
8. `ImageTextUnderstandingService.understand()`: Gọi Gemini phân tích ý định theo `IMAGE_TEXT_UNDERSTANDING_SCHEMA`:
   - Xác định `image_place_id`, `text_place_id`, `final_place_id`.
   - `is_reference_question`: Câu hỏi chỉ về ảnh (VD: *"ở đây có gì chơi?"*).
   - `is_specific_place_question`: Câu hỏi nhắc đích danh địa điểm cụ thể trong text.
9. `ImageTextResolver.resolve()`:
   - Xử lý xung đột (**Conflict Resolution**): Nếu ảnh là địa điểm A (VD: Kỳ Co) nhưng câu hỏi nhắc địa điểm B (VD: Eo Gió), resolver gán `conflict_type = "image_text_place_mismatch"`.
10. **Kế hoạch truy xuất**:
   - Truy xuất tài liệu từ `text_collection` theo `final_place_id`.
   - Nếu cần thêm ảnh liên quan $\rightarrow$ Thực hiện Hybrid Image Search với trọng số SigLIP **0.5** và Caption BGE-M3 **0.5**.
   - Lấy metadata từ `location_info`.
11. `AnswerGenerator.generate()`: Tạo câu trả lời có chứa gợi ý giải quyết xung đột (`answer_hint`) nếu ảnh và text nói về hai địa điểm khác nhau.
12. Cập nhật context (`last_image_place_id`, `last_text_place_id`, `last_conflict`) và trả về `okResponse(data)`.

---

## 5. GHI CHÚ VỀ PHẦN CHƯA THẤY RÕ TRONG CODE

- **Khai báo Router**: Endpoint `/api/chat` hiện được mount trực tiếp trong `src/app.js` thay vì tách file riêng trong `src/routes/chat.routes.js`.
- **Placeholder Pipeline**: `TravelQueryPipeline` trong `src/pipelines/travel-query.pipeline.js` hiện là file giữ chỗ, chưa được controller kích hoạt.
- **LLM Fallback**: `TextUnderstandingService` và `ImageTextUnderstandingService` có fallback heuristic nội bộ nhưng mặc định cấu hình `useFallbackWhenNotConfigured = false`. Hệ thống yêu cầu Gemini API Key hợp lệ để phân tích ý định.
- **Fusion Logic**: `FusionService` hiện tại đóng vai trò là một Data Aggregator gom dữ liệu retrieval thành payload chuẩn trước khi gửi vào LLM.
