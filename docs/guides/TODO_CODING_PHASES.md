# Kế Hoạch Triển Khai Code Từng Phase (TODO Coding Phases)

Tài liệu hướng dẫn chi tiết các giai đoạn triển khai (Phases 0 - 10) cho hệ thống **Travel AI Assistant** (Multimodal RAG du lịch Việt Nam).

---

## [ ] Phase 0: Backend Skeleton

Tôi đang xây dựng Travel AI Assistant.

Hãy tạo backend bằng NodeJS + Express theo mô hình MVC + Service + Repository + Pipeline.

### Yêu cầu:
- Chỉ tạo cấu trúc thư mục và các file khung.
- Không code Qdrant thật.
- Không code Gemini thật.
- Không code embedding thật.
- Không code frontend.
- Không tạo Docker Qdrant.
- Backend chỉ kết nối Qdrant external sau này.

### Cấu trúc mong muốn:
```text
apps/api/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── pipelines/
│   ├── planners/
│   ├── guards/
│   ├── llm/
│   ├── embeddings/
│   ├── schemas/
│   ├── types/
│   ├── utils/
│   └── tests/
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### Endpoint kiểm tra:
- `GET /api/health`

*Sau khi tạo xong, hãy hướng dẫn tôi chạy.*

---

## [ ] Phase 1: Config + Response Contract

Tiếp tục từ code hiện tại.

Chỉ làm phần config/env và response contract.

### Yêu cầu cấu hình đọc từ `.env`:
```env
APP_PORT=
API_PREFIX=

QDRANT_URL=
QDRANT_API_KEY=

QDRANT_LOCATION_COLLECTION=location_info
QDRANT_IMAGE_COLLECTION=image_collection
QDRANT_TEXT_COLLECTION=text_collection

GEMINI_API_KEY=
GEMINI_MODEL=

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_PRESIGNED_EXPIRES_IN=
S3_URL_MODE=

TOP_K_DOCS=
TOP_K_IMAGES=
IMAGE_MATCH_THRESHOLD=
IMAGE_LOW_CONFIDENCE_THRESHOLD=
```

### Lưu ý collection thực tế trong Qdrant:
- `location_info`
- `image_collection`
- `text_collection`

*(Không dùng tên `docs_embedding` nếu Qdrant thực tế đang là `text_collection`)*

### Chế độ `S3_URL_MODE` (2 giá trị):
1. `presigned`: Backend tạo presigned_url từ `s3_path`.
2. `public`: Backend tạo public URL nếu bucket public.

Payload ảnh trong Qdrant có field `s3_path`. `s3_path` đã chứa cả bucket và đường dẫn file:
- **Ví dụ**: `s3_path = vietnam-tourism/HON_KHO/image/00008_xxx.jpg`
- **Backend parse**:
  - `bucket = vietnam-tourism`
  - `s3_key = HON_KHO/image/00008_xxx.jpg`
- Không yêu cầu `payload.bucket`.
- Không yêu cầu `payload.s3_key`.

### ApiResponse thống nhất:
```typescript
interface ApiResponse<T = any> {
  success: boolean;
  status: "ok" | "error" | "out_of_scope" | "need_clarification" | "low_confidence";
  error_code: string | null;
  message: string | null;
  data: T;
  suggested_questions: string[];
}
```

### Helper `responseFormatter`:
- `okResponse()`
- `errorResponse()`
- `outOfScopeResponse()`
- `needClarificationResponse()`
- `lowConfidenceResponse()`

### Cấu trúc Response Image Item:
- `image_id`
- `title_name`
- `image_url`
- `s3_path`
- `s3_bucket`
- `s3_key`
- `caption`
- `caption_vi`
- `caption_en`
- `location_id`
- `location_key`
- `location_name`
- `score` hoặc `final_score`
- `rank`

### Phạm vi Phase 1:
- Không code pipeline.
- Không code Qdrant search.
- Không code Gemini.
- Không code frontend.

*Sau khi xong, liệt kê file đã tạo/sửa và cách test.*

---

## [ ] Phase 2: Input Router

Tiếp tục từ code hiện tại.

Chỉ làm Input Router cho endpoint `POST /api/chat`.

### Yêu cầu:
- Endpoint `POST /api/chat` nhận `multipart/form-data`:
  - `session_id`: string
  - `message`?: string
  - `image`?: file
- Tạo `inputRouter` để phân loại:
  - `text_only`: có `message`, không có `image`
  - `image_only`: có `image`, không có `message`
  - `image_text`: có cả `message` và `image`
  - `empty_input`: không có cả hai
- Nếu `empty_input` thì trả về:
  - `status = "error"`
  - `error_code = "EMPTY_INPUT"`
- Chưa gọi Qdrant.
- Chưa gọi Gemini.
- Chưa code pipeline thật.
- Với mỗi `input_type` hợp lệ, tạm trả mock response để biết router chạy đúng.

### Hướng dẫn test Postman (3 cases):
1. Chỉ gửi `message`
2. Chỉ gửi `image`
3. Gửi cả `message` + `image`

*Viết thêm các `console.log` để tiến hành test bằng cách log ra ở terminal.*

---

## [ ] Phase 3: Qdrant Health Check

Tiếp tục từ code hiện tại.

Chỉ làm Qdrant external client và kiểm tra kết nối.

### Yêu cầu:
- Không tạo collection.
- Không insert dữ liệu.
- Không tạo Docker Qdrant.
- Chỉ kết nối tới Qdrant external bằng `QDRANT_URL` và `QDRANT_API_KEY`.

### Tạo các module:
- `qdrantClient.ts`
- `qdrantHealthService.ts`
- Endpoint `GET /api/health/qdrant`

### Nhiệm vụ của endpoint:
1. Gọi Qdrant `/collections`
2. Kiểm tra 3 collection thực tế:
   - `location_info`
   - `image_collection`
   - `text_collection`
3. Nếu thiếu collection thì trả `error_code`: `QDRANT_COLLECTION_NOT_FOUND`
4. Nếu không kết nối được thì trả: `QDRANT_CONNECTION_ERROR`
5. Không kiểm tra `docs_embedding` nếu Qdrant thực tế không có collection đó.

*Sau khi xong, liệt kê file đã tạo/sửa và cách test.*

---

## [ ] Phase 4: Repository Layer + Hybrid Image Search + S3 URL Service

Tiếp tục từ code hiện tại.

Bây giờ chỉ làm Repository Layer cho Qdrant và service tạo `image_url` từ S3.

### Mục tiêu:
- Tạo tầng repository để backend đọc/search dữ liệu từ Qdrant external.
- Chuẩn hóa đúng payload thực tế của 3 collection.
- Tạo hybrid image search bằng text.
- Tạo `s3Service` để biến `payload.s3_path` thành `image_url` cho frontend.
- Không tạo collection.
- Không insert dữ liệu.
- Không tạo Docker Qdrant.
- Không tạo `CAPTION_COLLECTION` riêng.
- Không code pipeline thật.
- Không code Gemini.
- Không code frontend.

### Công nghệ:
- **Backend**: NodeJS + Typescript/Javascript + Express.
- **Kiến trúc**: MVC + Service + Repository + Pipeline.
- **Qdrant**: External service, lấy thông tin từ `.env`.

---

### Các Collection Thực Tế Trong Qdrant:

#### 1. `location_info`
- **Mục đích**: Lưu metadata địa điểm.
- **Payload thực tế gồm**:
  - `location_id`
  - `location_key`
  - `location_name`
  - `province`
  - `description`
  - `tags`
- **Ví dụ**:
```json
{
  "location_id": "LOC_012",
  "location_key": "HON_KHO",
  "location_name": "Hòn Khô",
  "province": "Bình Định",
  "description": "...",
  "tags": ["biển", "đảo", "san hô", "Hòn Khô", "Quy Nhơn", "Bình Định"]
}
```

#### 2. `text_collection`
- **Mục đích**: Lưu tài liệu/chunk text để hỏi đáp thông tin địa điểm.
- **Vector name**: `text_vector`
- **Payload thực tế gồm**:
  - `chunk_id`
  - `section_id`
  - `location_id`
  - `location_key`
  - `document_type`
  - `source_file`
  - `s3_path`
  - `section_number`
  - `section_title`
  - `chunk_index`
  - `total_chunks`
  - `content`
- **Ví dụ**:
```json
{
  "chunk_id": "LOC_012_overview_006_part_001",
  "section_id": "LOC_012_overview_006",
  "location_id": "LOC_012",
  "location_key": "HON_KHO",
  "document_type": "overview",
  "source_file": "overview.docx",
  "s3_path": "s3://vietnam-tourism/HON_KHO/docx/overview.docx",
  "section_number": "6",
  "section_title": "Điểm nổi bật",
  "chunk_index": 1,
  "total_chunks": 1,
  "content": "..."
}
```
- **Lưu ý**:
  - Không dùng `docs_embedding` nếu collection thực tế là `text_collection`.
  - Khi search docs, dùng collection `text_collection` và vector name `text_vector`.
  - Nội dung chunk lấy từ `payload.content`, không lấy từ `embedding_text`.

#### 3. `image_collection`
- **Mục đích**: Lưu ảnh, vector ảnh và vector caption để tìm ảnh bằng ảnh hoặc bằng text.
- **Trong collection này có 2 vector name**:
  1. `image_vector`: Vector ảnh gốc tạo bằng SigLIP image encoder. Dùng cho:
     - Upload ảnh → encode SigLIP image encoder → search `image_vector`.
     - Nhập text tìm ảnh → encode SigLIP text encoder → search `image_vector`.
  2. `caption_vector`: Vector caption/metadata ảnh tạo bằng BGE-M3. Dùng khi user nhập text muốn tìm ảnh theo ngữ nghĩa caption.
- **Payload thực tế gồm**:
  - `image_id`
  - `title_name`
  - `s3_path`
  - `location_id`
  - `location_key`
  - `location_name`
  - `caption_en`
  - `caption_vi`
  - `embedding_text`
  - `modality`
- **Ví dụ**:
```json
{
  "image_id": "LOC_012_00008_2a069b63edbebb92",
  "title_name": "00008_2a069b63edbebb92.jpg",
  "s3_path": "vietnam-tourism/HON_KHO/image/00008_2a069b63edbebb92.jpg",
  "location_id": "LOC_012",
  "location_key": "HON_KHO",
  "location_name": "Hòn Khô",
  "caption_en": "...",
  "caption_vi": "...",
  "embedding_text": "...",
  "modality": "image"
}
```
- **Lưu ý S3**:
  - Payload không có `bucket` và `s3_key` riêng.
  - `payload.s3_path` đã chứa cả bucket và đường dẫn file.
  - Ví dụ `vietnam-tourism/HON_KHO/image/00008_xxx.jpg` hoặc `s3://vietnam-tourism/HON_KHO/image/00008_xxx.jpg` đều parse ra:
    - `s3_bucket = vietnam-tourism`
    - `s3_key = HON_KHO/image/00008_xxx.jpg`

---

### Yêu cầu tạo các Repository:

#### 1. `locationRepository`
- **File**: `src/repositories/location.repository.js` (hoặc `.ts`)
- **Hàm cần có**: `getLocationById(locationId: string)`
- **Yêu cầu**:
  - Search hoặc scroll trong collection `location_info`.
  - Filter theo `payload.location_id`.
  - Trả về location metadata: `location_id`, `location_key`, `location_name`, `province`, `description`, `tags`.
  - Nếu không tìm thấy thì trả `null`.
  - Không throw lỗi lung tung ra ngoài, cần normalize lỗi Qdrant.

#### 2. `docsRepository` hoặc `textRepository`
- **File**: `src/repositories/text.repository.js` (hoặc `.ts`)
- **Hàm cần có**: `searchDocsByTextVector(params)`
- **Input**:
  - `textVector`: number[]
  - `locationId`?: string
  - `topK`?: number
- **Yêu cầu**:
  - Search trong collection `text_collection`, vector name = `text_vector`.
  - Nếu có `locationId` thì filter theo `payload.location_id`.
  - Trả về danh sách docs chunks đã chuẩn hóa: `chunk_id`, `section_id`, `location_id`, `location_key`, `document_type`, `source_file`, `s3_path`, `section_number`, `section_title`, `chunk_index`, `total_chunks`, `content`, `score`, `rank`.

#### 3. `imageRepository`
- **File**: `src/repositories/image.repository.js` (hoặc `.ts`)
- **Quan trọng**:
  - Chỉ dùng collection `image_collection`.
  - Không tạo `CAPTION_COLLECTION`.
  - Không search collection caption riêng.
  - `image_vector` và `caption_vector` đều nằm trong `image_collection`.
- **Helper `normalizeImagePayload(point)`** trả về:
  - `image_id`, `title_name`, `s3_path`, `s3_bucket`, `s3_key`, `image_url: null` (gắn sau qua s3Service), `caption` (`caption_vi || caption_en || embedding_text || title_name`), `caption_vi`, `caption_en`, `location_id`, `location_key`, `location_name`, `score`, `rank`, `source`.

##### Các hàm của `imageRepository`:

**A. `searchImagesByImageVector(params)`**
- Input: `imageVector: number[]`, `topK?: number`, `locationId?: string`
- Dùng khi: User upload ảnh.
- Vector name: `image_vector`, source = `"image_vector"`.

**B. `searchImagesByCaptionVector(params)`**
- Input: `textVector: number[]`, `topK?: number`, `locationId?: string`
- Dùng khi: User nhập text tìm ảnh theo caption/metadata.
- Vector name: `caption_vector`, source = `"caption_vector"`.

**C. `searchImagesBySiglipTextVector(params)`**
- Input: `siglipTextVector: number[]`, `topK?: number`, `locationId?: string`
- Dùng khi: User nhập text tìm ảnh theo visual-text matching của SigLIP.
- Vector name: `image_vector`, source = `"siglip_text_to_image_vector"`.

**D. `hybridSearchImagesByText(params)` (Quan trọng nhất)**
- **Input**:
  - `queryText`: string
  - `siglipTextVector`: number[]
  - `bgeTextVector`: number[]
  - `locationId`?: string
  - `topK`?: number (default: `config.TOP_K_IMAGES` hoặc 5)
  - `weights`?: `{ siglip?: number, caption?: number }` (default: 0.3 SigLIP / 0.7 Caption hoặc 0.5 / 0.5)
- **Ý tưởng**:
  - Nhánh 1: Search `image_collection` vector `image_vector` với `siglipTextVector`.
  - Nhánh 2: Search `image_collection` vector `caption_vector` với `bgeTextVector`.
  - Gộp kết quả theo `image_id` (hoặc `s3_path`).
  - Điểm tổng hợp: `final_score = siglip_score * siglip_weight + caption_score * caption_weight`.
- **Output mỗi item**:
  - `image_id`, `title_name`, `s3_path`, `s3_bucket`, `s3_key`, `image_url`, `caption`, `caption_vi`, `caption_en`, `location_id`, `location_key`, `location_name`, `final_score`, `siglip_score`, `caption_score`, `sources: string[]`, `rank`.

---

### Yêu cầu tạo `s3Service`:
- **File gợi ý**: `src/services/s3.service.js` (hoặc `.ts`)
- **Nhiệm vụ**:
  - Nhận image item từ `imageRepository`.
  - Lấy `s3_path` parse thành `bucket` và `s3_key`.
  - Tạo `image_url` để frontend render ảnh.
- **Hàm cần có**:
  - `parseS3Path(s3Path: string)`
  - `getImageUrlFromS3Path(s3Path: string)`
  - `attachImageUrls(images)`
- **Logic `parseS3Path`**:
  1. Nhận `s3Path` từ `payload.s3_path`.
  2. Nếu `s3Path` bắt đầu bằng `s3://` thì bỏ prefix.
  3. Split theo dấu `/`: Phần đầu tiên là `bucket`, phần còn lại là `s3_key`.
- **Logic tạo `image_url`**:
  1. Nếu `S3_URL_MODE = "presigned"`: Tạo presigned_url bằng AWS SDK từ `bucket + s3_key`.
  2. Nếu `S3_URL_MODE = "public"`: Tạo public URL nếu bucket public.
  3. Nếu không tạo được: Trả `image_url = null` và không làm crash pipeline.
- Không upload ảnh lên S3, không delete ảnh, không list bucket.

### Types & Error Handling:
- **Types/Interfaces**: `QdrantPointPayload`, `LocationMetadata`, `DocumentChunkResult`, `ImageSearchResult`, `HybridImageSearchResult`, `HybridImageSearchParams`.
- **Helpers**: `buildLocationFilter(locationId?: string)`, `parseS3Path(s3Path: string)`, `normalizeImagePayload(point)`.
- **Error Codes**: `QDRANT_CONNECTION_ERROR`, `QDRANT_COLLECTION_NOT_FOUND`, `QDRANT_VECTOR_NAME_ERROR`, `QDRANT_SEARCH_ERROR`.

### Debug Endpoints:
- `GET /api/debug/location/:location_id`
- `POST /api/debug/images/hybrid-search` (nhận mock vector)
- `POST /api/debug/s3/parse-path` (nhận `s3_path` trả `bucket`, `s3_key`, `image_url`)

*Sau khi code xong: Liệt kê file, giải thích ngắn, hướng dẫn test và debug bằng console.log.*

---

## [ ] Phase 5: Text Only Pipeline (Gọi Hybrid Search khi `need_images = true`)

Tiếp tục từ code hiện tại. Dựa theo kiến trúc: `architecture_1_text_understanding_rewrite_query.json`.

### Mục tiêu:
- Chỉ xử lý `input_type = "text_only"`.
- Không implement `image_only` và `image_text` pipeline trong phase này.
- Không làm frontend.

### Các trường hợp Text Only:
- User hỏi thông tin: *"Biển Quy Hòa có gì đẹp?"*, *"Kỳ Co ở đâu?"*
- User hỏi follow-up: *"Ở đó có gì chơi?"*, *"Chỗ này đẹp không?"*
- User muốn xem ảnh: *"Cho tôi xem ảnh Eo Gió"*, *"Có ảnh đẹp ở Quy Hòa không?"*
- User hỏi về ảnh trả về trước đó: *"Ảnh thứ hai là ở đâu?"*

---

### Các bước thực hiện:

#### 1. `POST /api/chat` nhận request `text_only`
- Input: `session_id: string`, `message: string` (không có image).
- Nếu không phải `text_only`: Trả error `PIPELINE_NOT_IMPLEMENTED`.

#### 2. Load Conversation Context (`contextService`)
- Lưu theo `session_id` trong RAM.
- Gồm: `old_input`, `old_rewrite_query`, `active_location_id`, `active_location_name`, `last_returned_images`, `last_suggested_locations`, `last_text_place_id`, `last_conflict`.
- Chỉ update context khi response `status = "ok"`.

#### 3. Text Domain Guard (`textDomainGuard`)
- **Hợp lệ**: Hỏi về du lịch Việt Nam, hoặc follow-up khi context đã có `active_location_id`/`active_location_name`.
- **Không hợp lệ**: *"Bạn sửa code Python giúp tôi"*, *"Giải bài toán này"*, *"Tư vấn laptop"*, *"Messi là ai?"*
  - Trả về: `status = "out_of_scope"`, `error_code = "TEXT_NOT_TRAVEL_RELATED"`.
- **Follow-up mơ hồ nhưng thiếu context**:
  - Ví dụ: *"Ở đó có gì chơi?"*, *"Chỗ này đẹp không?"* mà context không có `active_location_id`.
  - Trả về: `status = "need_clarification"`, `error_code = "MISSING_LOCATION_CONTEXT"`.

#### 4. LLM Text Understanding (`llm/textUnderstanding`)
- Input: `message`, `conversation context`.
- Output JSON Schema:
```json
{
  "rewrite_query": "string",
  "need_docs": true,
  "need_images": false,
  "need_metadata": true,
  "location_id": "string | null",
  "location_name": "string | null",
  "is_follow_up": false,
  "intent": "overview | activity | image_search | metadata | location_lookup | unknown"
}
```
- Nếu Gemini chưa tích hợp thật: Tạo mock LLM service có interface rõ ràng.

#### 5. Resolve Reference (`referenceResolver`)
- Xử lý các từ: *"ở đó"*, *"chỗ này"*, *"địa điểm này"*, *"nơi này"*, *"ảnh thứ hai"*.
- Gán `active_location_id` / `active_location_name` từ context vào query nếu cần.

#### 6. Detect Need Flags & Retrieval Planner (`retrievalPlanner`)
- Lập kế hoạch truy xuất: `shouldSearchDocs`, `shouldSearchImages`, `shouldGetMetadata`, `finalLocationId`, `topKDocs`, `topKImages`.

#### 7. Retrieval Execution & Embedding
- Khi `need_docs = true`: Encode `rewrite_query` bằng BGE-M3 $\rightarrow$ gọi `docsRepository.searchDocsByTextVector`.
- Khi `need_images = true`:
  - Encode `rewrite_query` bằng SigLIP text encoder $\rightarrow$ `siglipTextVector`.
  - Encode `rewrite_query` bằng BGE-M3 text encoder $\rightarrow$ `bgeTextVector`.
  - Gọi `imageRepository.hybridSearchImagesByText(...)`.
  - Bắt buộc gọi `s3Service.attachImageUrls(images)`.
- Khi `need_metadata = true`: Gọi `locationRepository.getLocationById(locationId)`.

#### 8. Result Fusion (`fusionService`) & Answer Generator (`llm/answerGenerator`)
- Tổng hợp context: `question`, `rewrite_query`, `location metadata`, `relevant docs chunks`, `related images`.
- Trả lời bằng tiếng Việt, không bịa thông tin ngoài dữ liệu retrieval.
- Format đúng `ApiResponse` contract.

#### 9. Update Conversation Context
- Cập nhật khi `status = "ok"`: `old_input`, `old_rewrite_query`, `active_location_id`, `active_location_name`, `last_returned_images`, `last_text_place_id`, `last_conflict = null`.

---

## [ ] Phase 6: Thay Mock Gemini Bằng Gemini Thật

Tiếp tục từ code hiện tại.

Chỉ thay mock LLM bằng Gemini thật cho **Text Understanding** và **Answer Generator**.

### Yêu cầu:
- Tạo `geminiClient.ts` sử dụng `GEMINI_API_KEY` và `GEMINI_MODEL` từ `.env`.
- Text Understanding trả về đúng JSON Schema:
  - `rewrite_query`, `need_docs`, `need_images`, `need_metadata`, `location_id`, `location_name`, `is_follow_up`, `intent`.
  - Bắt lỗi `LLM_CLASSIFICATION_ERROR` nếu Gemini trả sai JSON.
- Answer Generator trả lời tiếng Việt, không bịa ngoài dữ liệu retrieval. Nếu thiếu docs thì phản hồi chưa có đủ dữ liệu.
- Không đụng `image_only` pipeline, `image_text` pipeline, không làm frontend.

*Sau khi xong, hướng dẫn test lại text only.*

---

## [ ] Phase 7: Image Only Pipeline

Tiếp tục từ code hiện tại. Dựa theo file `architecture_2_image_only_simple.json`.

### Yêu cầu:
- Chỉ xử lý `input_type = "image_only"`.
- Không sửa logic `text_only` nếu không cần. Không code `image_text`.

### Luồng Image Only Pipeline:
1. Nhận image upload.
2. Encode image bằng SigLIP service (`ImageEmbeddingService`).
3. Search `image_collection` bằng `image_vector` qua `imageRepository.searchImagesByImageVector(...)`.
4. Gọi `s3Service.attachImageUrls(matchedImages)`.
5. Confidence Guard:
   - `score >= IMAGE_MATCH_THRESHOLD`: Nhận diện thành công.
   - `IMAGE_LOW_CONFIDENCE_THRESHOLD <= score < IMAGE_MATCH_THRESHOLD`: Trả `low_confidence` và danh sách ứng viên `candidate_locations`.
   - `score < IMAGE_LOW_CONFIDENCE_THRESHOLD`: Trả `out_of_scope` (`IMAGE_NOT_TRAVEL_RELATED`).
6. Lấy `matched image_id`, `location_id`.
7. Lấy metadata qua `locationRepository.getLocationById(location_id)`.
8. Tạo default query: *"Đây là địa điểm nào và thông tin tổng quan là gì?"*.
9. Search `text_collection` với filter `location_id`.
10. Result Fusion.
11. Gemini Answer Generator sinh câu trả lời tiếng Việt.
12. Format response và cập nhật context hội thoại.

*Sau khi xong, hướng dẫn test bằng Postman với image upload.*

---

## [ ] Phase 8: Image + Text Pipeline (Dùng Hybrid Search Khi Cần Ảnh)

Tiếp tục từ code hiện tại. Dựa theo kiến trúc: `architecture_3_text_image_specific_question.json`.

### Mục tiêu:
- Xử lý `input_type = "image_text"` khi người dùng gửi đồng thời cả ảnh và câu hỏi.
- Giữ nguyên `text_only` và `image_only` pipeline đã chạy được.
- Collection ảnh duy nhất là `image_collection` với 2 named vectors: `image_vector` và `caption_vector`.

### Các kịch bản Image + Text:
- **Case A (Tham chiếu theo ảnh)**: Ảnh Kỳ Co + *"Ở đây có gì chơi?"*
  - `is_reference_question = true`, `final_place_id = image_place_id`, `rewrite_query = "Kỳ Co có gì chơi?"`.
- **Case B (Text nhắc cùng địa điểm với ảnh)**: Ảnh Kỳ Co + *"Kỳ Co có gì chơi?"*
  - `final_place_id = image_place_id`.
- **Case C (Text nhắc địa điểm khác ảnh - Conflict)**: Ảnh Quy Hòa + *"Eo Gió có gì chơi?"*
  - `image_place_id = "quy_hoa"`, `text_place_id = "eo_gio"`, `final_place_id = "eo_gio"`.
  - `conflict_type = "image_text_place_mismatch"`.
  - Trả lời theo địa điểm trong text và giải thích ngắn về sự khác biệt giữa ảnh và câu hỏi.
- **Case D (So sánh)**: Ảnh Kỳ Co + *"Chỗ này so với Eo Gió thì nơi nào đẹp hơn?"*
  - `intent = "comparison"`.

### Luồng xử lý chi tiết:
1. Nhận `session_id`, `message`, `image`.
2. Load Conversation Context.
3. Image Understanding: SigLIP Encode $\rightarrow$ `searchImagesByImageVector`.
4. Confidence Guard kiểm tra độ tin cậy của ảnh.
5. Text Domain Guard kiểm tra nội dung text.
6. LLM Text Understanding phân tích ngữ nghĩa, nhận diện `image_place_id`, `text_place_id`, `final_place_id`, `is_reference_question`, `intent`.
7. Resolve Conflict giữa ảnh và text.
8. Retrieval Execution:
   - Search Docs qua `text_collection` (BGE-M3).
   - Get Location Metadata qua `location_info`.
   - Hybrid Search Image qua `image_collection` (SigLIP text-to-image + BGE-M3 caption) $\rightarrow$ gọi `s3Service.attachImageUrls(...)`.
9. Result Fusion & Gemini Answer Generator.
10. Format Response theo `ApiResponse` (kèm thông tin debug, hybrid branches, conflict).
11. Update Context hội thoại khi `status = "ok"`.

---

## [ ] Phase 9: Frontend

Tạo frontend ReactTS + Vite cho Travel AI Assistant dựa theo `FRONTEND_ARCHITECTURE.md`.

### Yêu cầu:
- Chat UI trực quan, hỗ trợ upload ảnh, gửi `multipart/form-data` đến `POST /api/chat`.
- Xử lý render theo ApiResponse: `ok`, `out_of_scope`, `need_clarification`, `low_confidence`, `error`.
- Frontend không tự parse `s3_path` hay dùng `s3://`, chỉ render bằng `image_url` từ backend trả về.

### Các Component cần có:
- `ChatPage`
- `ChatWindow`
- `ChatInput`
- `MessageBubble`
- `ImageUploadBox`
- `BotMessage`
- `UserMessage`
- `ImageGallery` & `ImageCard`
- `LocationInfoPanel`
- `SuggestedQuestions`
- `ErrorMessage`

*Sau khi xong, hướng dẫn chạy frontend.*

---

## [ ] Phase 10: Integration Test

Tiến hành kiểm thử tích hợp toàn bộ hệ thống từ Frontend $\rightarrow$ Backend $\rightarrow$ Qdrant $\rightarrow$ Embedding/LLM Services $\rightarrow$ S3.
- Test `text_only` (hỏi đáp, follow-up, tìm ảnh).
- Test `image_only` (nhận diện ảnh, hiển thị thông tin, fallback low confidence).
- Test `image_text` (tham chiếu ảnh, mismatch ảnh và text, so sánh).
- Test xử lý lỗi mạng, hết hạn presigned URL, lỗi rate limit Gemini API key rotation.
