[ ] Phase 0 - Backend skeleton
Tôi đang xây dựng Travel AI Assistant.

Hãy tạo backend bằng NodeJS + Express theo mô hình MVC + Service + Repository + Pipeline.

Yêu cầu:
- Chỉ tạo cấu trúc thư mục và các file khung.
- Không code Qdrant thật.
- Không code Gemini thật.
- Không code embedding thật.
- Không code frontend.
- Không tạo Docker Qdrant.
- Backend chỉ kết nối Qdrant external sau này.

Cấu trúc mong muốn:

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

Tạo endpoint test:
GET /api/health

Sau khi tạo xong, hãy hướng dẫn tôi chạy

[ ] Phase 1 - Config + response contract
Tiếp tục từ code hiện tại.

Chỉ làm phần config/env và response contract.

Yêu cầu:

Tạo config đọc từ .env:

APP_PORT
API_PREFIX

QDRANT_URL
QDRANT_API_KEY

QDRANT_LOCATION_COLLECTION=location_info
QDRANT_IMAGE_COLLECTION=image_collection
QDRANT_TEXT_COLLECTION=text_collection

GEMINI_API_KEY
GEMINI_MODEL

AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
S3_PRESIGNED_EXPIRES_IN
S3_URL_MODE

TOP_K_DOCS
TOP_K_IMAGES
IMAGE_MATCH_THRESHOLD
IMAGE_LOW_CONFIDENCE_THRESHOLD

Lưu ý collection thực tế trong Qdrant:

location_info
image_collection
text_collection

Không dùng tên docs_embedding nếu Qdrant thực tế đang là text_collection.

S3_URL_MODE có 2 giá trị:

presigned: backend tạo presigned_url từ s3_path.
public: backend tạo public URL nếu bucket public.

Payload ảnh trong Qdrant có field s3_path.
s3_path đã chứa cả bucket và đường dẫn file.

Ví dụ:
s3_path = vietnam-tourism/HON_KHO/image/00008_xxx.jpg

Backend phải parse:

bucket = vietnam-tourism
s3_key = HON_KHO/image/00008_xxx.jpg

Không yêu cầu payload.bucket.
Không yêu cầu payload.s3_key.

Tạo ApiResponse thống nhất:
success
status
error_code
message
data
suggested_questions
Tạo helper responseFormatter:
okResponse()
errorResponse()
outOfScopeResponse()
needClarificationResponse()
lowConfidenceResponse()
Response image item sau này phải có:
image_id
title_name
image_url
s3_path
s3_bucket
s3_key
caption
caption_vi
caption_en
location_id
location_key
location_name
score hoặc final_score
rank

Không code pipeline.
Không code Qdrant search.
Không code Gemini.
Không code frontend.

Sau khi xong, liệt kê file đã tạo/sửa và cách test.

[ ] Phase 2 - Input router
Tiếp tục từ code hiện tại.

Chỉ làm Input Router cho endpoint POST /api/chat.

Yêu cầu:
- Endpoint POST /api/chat nhận multipart/form-data:
  session_id: string
  message?: string
  image?: file

- Tạo inputRouter để phân loại:
  text_only: có message, không có image
  image_only: có image, không có message
  image_text: có cả message và image
  empty_input: không có cả hai

- Nếu empty_input thì trả:
  status = error
  error_code = EMPTY_INPUT

- Chưa gọi Qdrant.
- Chưa gọi Gemini.
- Chưa code pipeline thật.
- Với mỗi input_type hợp lệ, tạm trả mock response để biết router chạy đúng.

Sau khi xong, hướng dẫn tôi test bằng Postman
Đến đây bạn test 3 case:
1. Chỉ gửi message
2. Chỉ gửi image
3. Gửi cả message + image

Viết thêm các Console.log để tiến hình text bằng cách log ra ở terminal
[ ] Phase 3 - Qdrant health check
Tiếp tục từ code hiện tại.

Chỉ làm Qdrant external client và kiểm tra kết nối.

Yêu cầu:

Không tạo collection.
Không insert dữ liệu.
Không tạo Docker Qdrant.
Chỉ kết nối tới Qdrant external bằng:
QDRANT_URL
QDRANT_API_KEY

Tạo:

qdrantClient.ts
qdrantHealthService.ts
endpoint GET /api/health/qdrant

Endpoint này cần:

gọi Qdrant /collections
kiểm tra 3 collection thực tế:
location_info
image_collection
text_collection

Nếu thiếu collection thì trả error_code:
QDRANT_COLLECTION_NOT_FOUND

Nếu không kết nối được thì trả:
QDRANT_CONNECTION_ERROR

Không kiểm tra docs_embedding nếu Qdrant thực tế không có collection đó.

Sau khi xong, liệt kê file đã tạo/sửa và cách test.

[ ] Phase 4 - Repository Layer + Hybrid Image Search + S3 URL Service

Tiếp tục từ code hiện tại.

Bây giờ chỉ làm Repository Layer cho Qdrant và service tạo image_url từ S3.

Mục tiêu:

* Tạo tầng repository để backend đọc/search dữ liệu từ Qdrant external.
* Chuẩn hóa đúng payload thực tế của 3 collection.
* Tạo hybrid image search bằng text.
* Tạo s3Service để biến payload.s3_path thành image_url cho frontend.
* Không tạo collection.
* Không insert dữ liệu.
* Không tạo Docker Qdrant.
* Không tạo CAPTION_COLLECTION riêng.
* Không code pipeline thật.
* Không code Gemini.
* Không code frontend.

Công nghệ:

* Backend: NodeJS + Javascript + Express.
* Kiến trúc: MVC + Service + Repository + Pipeline.
* Qdrant là external service, lấy thông tin từ .env.

Các collection thực tế trong Qdrant:

1. location_info

Mục đích:

* Lưu metadata địa điểm.

Payload thực tế gồm:

* location_id
* location_key
* location_name
* province
* description
* tags

Ví dụ:
{
"location_id": "LOC_012",
"location_key": "HON_KHO",
"location_name": "Hòn Khô",
"province": "Bình Định",
"description": "...",
"tags": ["biển", "đảo", "san hô", "Hòn Khô", "Quy Nhơn", "Bình Định"]
}

Repository cần đọc collection:

* location_info

2. text_collection

Mục đích:

* Lưu tài liệu/chunk text để hỏi đáp thông tin địa điểm.

Vector name:

* text_vector

Payload thực tế gồm:

* chunk_id
* section_id
* location_id
* location_key
* document_type
* source_file
* s3_path
* section_number
* section_title
* chunk_index
* total_chunks
* content

Ví dụ:
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

Lưu ý:

* Không dùng docs_embedding nếu collection thực tế là text_collection.
* Khi search docs, dùng collection text_collection.
* Khi search docs, dùng vector name text_vector.
* Nội dung chunk lấy từ payload.content , không lấy từ embedding_text.

3. image_collection

Mục đích:

* Lưu ảnh, vector ảnh và vector caption để tìm ảnh bằng ảnh hoặc bằng text.

Trong collection này có 2 vector name:

* image_vector
* caption_vector

image_vector:

* Là vector ảnh gốc, được tạo bằng SigLIP image encoder.
* Dùng cho 2 trường hợp:

  1. User upload ảnh → encode ảnh bằng SigLIP image encoder → search image_vector.
  2. User nhập text muốn tìm ảnh → encode text bằng SigLIP text encoder → search image_vector.

caption_vector:

* Là vector caption/metadata ảnh, được tạo bằng BGE-M3.
* Dùng khi user nhập text muốn tìm ảnh theo ngữ nghĩa caption.

Payload thực tế gồm:

* image_id
* title_name
* s3_path
* location_id
* location_key
* location_name
* caption_en
* caption_vi
* embedding_text
* modality

Ví dụ:
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

Lưu ý S3:

* payload không có bucket riêng.
* payload không có s3_key riêng.
* payload.s3_path đã chứa cả bucket và đường dẫn tới file.

Ví dụ:
s3_path = vietnam-tourism/HON_KHO/image/00008_xxx.jpg

Backend phải parse:

* s3_bucket = vietnam-tourism
* s3_key = HON_KHO/image/00008_xxx.jpg

Nếu s3_path có dạng:
s3://vietnam-tourism/HON_KHO/image/00008_xxx.jpg

Thì vẫn parse ra:

* s3_bucket = vietnam-tourism
* s3_key = HON_KHO/image/00008_xxx.jpg

Yêu cầu tạo các repository sau:

1. locationRepository

File gợi ý:
src/repositories/location.repository.js

Hàm cần có:
getLocationById(locationId: string)

Yêu cầu:

* Search hoặc scroll trong collection location_info.
* Filter theo payload.location_id.
* Trả về location metadata:

  * location_id
  * location_key
  * location_name
  * province
  * description
  * tags
* Nếu không tìm thấy thì trả null.
* Không throw lỗi lung tung ra ngoài, cần normalize lỗi Qdrant.

2. docsRepository hoặc textRepository

File gợi ý:
src/repositories/text.repository.js
hoặc:
src/repositories/docs.repository.js

Hàm cần có:
searchDocsByTextVector(params)

Input:

* textVector: number[]
* locationId?: string
* topK?: number

Yêu cầu:

* Search trong collection text_collection.
* Vector name = text_vector.
* Nếu có locationId thì filter theo payload.location_id.
* Trả về danh sách docs chunks đã chuẩn hóa:

  * chunk_id
  * section_id
  * location_id
  * location_key
  * document_type
  * source_file
  * s3_path
  * section_number
  * section_title
  * chunk_index
  * total_chunks
  * content
  * score
  * rank

Lưu ý:

* content lấy từ payload.content.
* Không yêu cầu payload.embedding_text ở text_collection.
* Không dùng collection docs_embedding.

3. imageRepository

File gợi ý:
src/repositories/image.repository.js

Quan trọng:

* Chỉ dùng collection image_collection.
* Không tạo CAPTION_COLLECTION.
* Không search collection caption riêng.
* image_vector và caption_vector đều nằm trong image_collection.

Cần có helper normalizeImagePayload(point).

normalizeImagePayload cần trả:

* image_id
* title_name
* s3_path
* s3_bucket
* s3_key
* image_url: null ở repository
* caption
* caption_vi
* caption_en
* location_id
* location_key
* location_name
* score
* rank
* source

Trong đó:

* caption = caption_vi || caption_en || embedding_text || title_name
* s3_bucket và s3_key parse từ payload.s3_path.
* image_url để null ở repository, s3Service sẽ gắn sau.

Các hàm cần có:

A. searchImagesByImageVector(params)

Input:

* imageVector: number[]
* topK?: number
* locationId?: string

Dùng khi:

* User upload ảnh.

Yêu cầu:

* Search collection image_collection.
* Vector name = image_vector.
* Query vector = imageVector.
* Nếu có locationId thì filter theo payload.location_id.
* Trả về danh sách ảnh đã chuẩn hóa:

  * image_id
  * title_name
  * s3_path
  * s3_bucket
  * s3_key
  * image_url
  * caption
  * caption_vi
  * caption_en
  * location_id
  * location_key
  * location_name
  * score
  * rank
  * source = "image_vector"

B. searchImagesByCaptionVector(params)

Input:

* textVector: number[]
* topK?: number
* locationId?: string

Dùng khi:

* User nhập text tìm ảnh theo caption/metadata.

Yêu cầu:

* Search collection image_collection.
* Vector name = caption_vector.
* Query vector = textVector.
* Nếu có locationId thì filter theo payload.location_id.
* Trả về danh sách ảnh đã chuẩn hóa:

  * image_id
  * title_name
  * s3_path
  * s3_bucket
  * s3_key
  * image_url
  * caption
  * caption_vi
  * caption_en
  * location_id
  * location_key
  * location_name
  * score
  * rank
  * source = "caption_vector"

C. searchImagesBySiglipTextVector(params)

Input:

* siglipTextVector: number[]
* topK?: number
* locationId?: string

Dùng khi:

* User nhập text tìm ảnh theo hướng visual-text matching của SigLIP.

Yêu cầu:

* Search collection image_collection.
* Vector name = image_vector.
* Query vector = siglipTextVector.
* Nếu có locationId thì filter theo payload.location_id.
* Trả về danh sách ảnh đã chuẩn hóa:

  * image_id
  * title_name
  * s3_path
  * s3_bucket
  * s3_key
  * image_url
  * caption
  * caption_vi
  * caption_en
  * location_id
  * location_key
  * location_name
  * score
  * rank
  * source = "siglip_text_to_image_vector"

D. hybridSearchImagesByText(params)

Đây là hàm quan trọng nhất.

Input:

* queryText: string
* siglipTextVector: number[]
* bgeTextVector: number[]
* locationId?: string
* topK?: number
* weights?: {
  siglip?: number
  caption?: number
  }

Default:

* topK = config.TOP_K_IMAGES hoặc 5
* siglip weight = 0.3
* caption weight = 0.7

Ý tưởng:
User nhập text muốn tìm ảnh.
Hệ thống search ảnh bằng 2 nhánh khác nhau rồi gộp điểm.

Nhánh 1:

* queryText
* encode bằng SigLIP text encoder ở service bên ngoài repository
* truyền siglipTextVector vào repository
* search collection image_collection
* vector name = image_vector

Nhánh 2:

* queryText
* encode bằng BGE-M3 text embedding ở service bên ngoài repository
* truyền bgeTextVector vào repository
* search collection image_collection
* vector name = caption_vector

Sau đó:

* Gộp kết quả theo image_id.
* Nếu không có image_id thì dùng s3_path làm key.
* Nếu cùng một ảnh xuất hiện ở cả 2 nhánh thì cộng điểm.
* Nếu ảnh chỉ xuất hiện ở 1 nhánh thì vẫn giữ.
* Công thức điểm:
  final_score = siglip_score * siglip_weight + caption_score * caption_weight

Yêu cầu output mỗi item:

* image_id
* title_name
* s3_path
* s3_bucket
* s3_key
* image_url
* caption
* caption_vi
* caption_en
* location_id
* location_key
* location_name
* final_score
* siglip_score
* caption_score
* sources: string[]
* rank

Trong đó:

* siglip_score là điểm từ nhánh search image_vector bằng SigLIP text vector.
* caption_score là điểm từ nhánh search caption_vector bằng BGE-M3 text vector.
* sources có thể gồm:

  * "siglip_text_to_image_vector"
  * "caption_bge_m3_vector"

Lưu ý:

* Repository không tự encode text.
* Repository chỉ nhận vector đã được tạo bởi embedding service.
* Không gọi Gemini trong repository.
* Không gọi pipeline trong repository.
* Không tự đổi tên collection/vector name.
* Không tự tạo collection Qdrant.

Cần tạo type/interface rõ ràng:

* QdrantPointPayload
* LocationMetadata
* DocumentChunkResult
* ImageSearchResult
* HybridImageSearchResult
* HybridImageSearchParams

Cần tạo helper:

* buildLocationFilter(locationId?: string)
* parseS3Path(s3Path: string)
* normalizeImagePayload(point)

Cần handle lỗi:

* QDRANT_CONNECTION_ERROR
* QDRANT_COLLECTION_NOT_FOUND
* QDRANT_VECTOR_NAME_ERROR
* QDRANT_SEARCH_ERROR

Nếu Qdrant client đang dùng @qdrant/js-client-rest thì hãy dùng đúng format named vector của Qdrant.

Tạo thêm s3Service:

File gợi ý:
src/services/s3.service.js

Nhiệm vụ:

* Nhận image item từ imageRepository.
* Lấy s3_path.
* Parse s3_path thành bucket và s3_key.
* Tạo image_url để frontend render ảnh.

Hàm cần có:

* parseS3Path(s3Path: string)
* getImageUrlFromS3Path(s3Path: string)
* attachImageUrls(images)

Logic parseS3Path:

1. Nhận s3Path từ payload.s3_path.
2. Nếu s3Path bắt đầu bằng s3:// thì bỏ prefix s3://.
3. Split theo dấu /.
4. Phần đầu tiên là bucket.
5. Phần còn lại là s3_key.

Ví dụ:
s3_path = vietnam-tourism/HON_KHO/image/00008_xxx.jpg

Kết quả:

* bucket = vietnam-tourism
* s3_key = HON_KHO/image/00008_xxx.jpg

Ví dụ:
s3_path = s3://vietnam-tourism/HON_KHO/image/00008_xxx.jpg

Kết quả:

* bucket = vietnam-tourism
* s3_key = HON_KHO/image/00008_xxx.jpg

Logic tạo image_url:

1. Nếu S3_URL_MODE = "presigned":
   tạo presigned_url bằng AWS SDK từ bucket + s3_key.
2. Nếu S3_URL_MODE = "public":
   tạo public URL nếu bucket public.
3. Nếu không tạo được image_url:
   trả image_url = null và không làm crash pipeline.

Không upload ảnh lên S3.
Không delete ảnh.
Không list bucket.
Chỉ tạo URL đọc ảnh từ s3_path.

Sau khi code xong:

1. Liệt kê tất cả file đã tạo/sửa.
2. Giải thích ngắn repository nào làm gì.
3. Thêm endpoint debug nếu cần để test:

   * GET /api/debug/location/:location_id
   * POST /api/debug/images/hybrid-search
   * POST /api/debug/s3/parse-path

Endpoint POST /api/debug/images/hybrid-search có thể nhận mock vector để test repository, không cần embedding thật.
Endpoint POST /api/debug/s3/parse-path nhận s3_path và trả bucket, s3_key, image_url nếu tạo được.

Không làm bất kỳ phần nào ngoài Repository Layer và s3Service.
Và làm song hãy hướng dẫn tôi chạy và có thể debug bằng console.log khi code những phần quang trọng

[ ] Phase 5 - Text Only Pipeline, gọi Hybrid Search khi need_images = true
Tiếp tục từ code hiện tại.

Bây giờ chỉ implement PHASE 5: Text Only Pipeline.

Dựa theo kiến trúc:
architecture_1_text_understanding_rewrite_query.json

Mục tiêu:

* Chỉ xử lý input_type = "text_only".
* Không implement image_only pipeline.
* Không implement image_text pipeline.
* Không làm frontend.
* Không refactor lớn làm hỏng code đã có.

Luồng Text Only Pipeline dùng cho:

* User nhập text hỏi địa điểm.
* User nhập follow-up text.
* User nhập text muốn xem ảnh địa điểm.

Ví dụ:

* "Biển Quy Hòa có gì đẹp?"
* "Kỳ Co ở đâu?"
* "Ở đó có gì chơi?"
* "Cho tôi xem ảnh Eo Gió"
* "Có ảnh đẹp ở Quy Hòa không?"
* "Ảnh thứ hai là ở đâu?"

Các bước cần implement:

1. POST /api/chat nhận request text_only

Input:

* session_id: string
* message: string
* không có image

Nếu input_type không phải text_only:

* Không xử lý ở pipeline này.
* Trả response rõ:

  * status = "error"
  * error_code = "PIPELINE_NOT_IMPLEMENTED"
  * message = "Pipeline này chưa được implement trong phase hiện tại."

2. Load Conversation Context

Tạo hoặc dùng contextService.

Context lưu theo session_id trong RAM trước.

Context có thể gồm:

* old_input
* old_rewrite_query
* active_location_id
* active_location_name
* last_returned_images
* last_suggested_locations
* last_text_place_id
* last_conflict

Nguyên tắc:

* Chỉ update context khi response status = ok.
* Không update context khi out_of_scope, low_confidence, error.
* Nếu need_clarification thì có thể lưu pending_question nếu đã có sẵn thiết kế.

3. Text Domain Guard

Tạo textDomainGuard.

Mục tiêu:

* Cho phép câu hỏi du lịch Việt Nam.
* Cho phép follow-up nếu context có active_location_id hoặc active_location_name.
* Chặn câu hỏi ngoài domain.

Valid:

* "Biển Quy Hòa có gì đẹp?"
* "Kỳ Co ở đâu?"
* "Cho tôi xem ảnh Eo Gió"
* "Ở đó có gì chơi?"
* "Chỗ này đẹp không?"
* "Ảnh thứ hai là ở đâu?"

Invalid:

* "Bạn sửa code Python giúp tôi"
* "Giải bài toán này"
* "Tư vấn laptop"
* "Messi là ai?"

Nếu text ngoài domain:
Trả:

* success = false
* status = "out_of_scope"
* error_code = "TEXT_NOT_TRAVEL_RELATED"
* message = "Mình chỉ hỗ trợ các câu hỏi liên quan đến địa điểm du lịch ở Việt Nam..."
* Không search Qdrant.
* Không update context.

Nếu câu follow-up mơ hồ nhưng không có context:
Ví dụ:

* "Ở đó có gì chơi?"
* "Chỗ này đẹp không?"
* "Địa điểm này ở đâu?"

Và context không có active_location_id:
Trả:

* success = false
* status = "need_clarification"
* error_code = "MISSING_LOCATION_CONTEXT"
* message = "Bạn đang hỏi 'ở đó' nhưng mình chưa biết bạn đang nhắc đến địa điểm nào..."

4. LLM Text Understanding

Tạo llm/textUnderstanding.

Input cho LLM:

* message
* conversation context:

  * old_input
  * old_rewrite_query
  * active_location_id
  * active_location_name
  * last_returned_images

Output bắt buộc là JSON:

{
"rewrite_query": "string",
"need_docs": true | false,
"need_images": false | true,
"need_metadata": true,
"location_id": "string | null",
"location_name": "string | null",
"is_follow_up": true | false,
"intent": "overview | activity | image_search | metadata | location_lookup | unknown"
}

Yêu cầu:

* Nếu user hỏi "Cho tôi xem ảnh Kỳ Co" thì:

  * need_images = true
  * need_docs = false
  * need_metadata = true
  * intent = "image_search"
  * rewrite_query = "Ảnh đẹp về Kỳ Co" hoặc tương đương

* Nếu user hỏi "Biển Quy Hòa có gì đẹp?" thì:

  * need_docs = true
  * need_metadata = true
  * need_images = false
  * intent = "overview" hoặc "activity"
  * rewrite_query = "..." hoặc tương đương

* Nếu user hỏi "Ở đó có gì chơi?" và context active_location_name = "Biển Quy Hòa":

  * rewrite_query = "Biển Quy Hòa có gì chơi?"
  * is_follow_up = true
  * location_id = active_location_id nếu có
  * location_name = active_location_name nếu có

Nếu Gemini chưa tích hợp thật:

* Có thể tạo mock LLM service trước.
* Nhưng phải tách interface rõ để sau này thay bằng Gemini thật.
* Không hard-code lung tung trong pipeline.

5. Resolve Reference

Tạo referenceResolver nếu cần.

Mục tiêu:

* Xử lý các từ tham chiếu:

  * "ở đó"
  * "chỗ này"
  * "địa điểm này"
  * "nơi này"
  * "ảnh thứ hai"
  * "ảnh này"

Nếu LLM output thiếu location_id nhưng context có active_location_id:

* Dùng active_location_id làm location_id.
* Dùng active_location_name làm location_name.
* Rewrite query phải rõ nghĩa.

Ví dụ:
Input:

* message = "Ở đó có gì chơi?"
* active_location_name = "Biển Quy Hòa"

Output:

* rewrite_query = "Biển Quy Hòa có gì chơi?"
* location_id = "quy_hoa"

6. Detect Need Flags

Dựa vào LLM output:

* need_docs
* need_images
* need_metadata

Cần đảm bảo:

* Câu hỏi thông tin → need_docs = true.
* Câu hỏi ảnh → need_images = true.
* Tất cả đều cần → need_metadata = true.
* Nếu có location_id thì retrieval phải filter theo location_id.

7. Retrieval Planner

Tạo retrievalPlanner.

Input:

* rewrite_query
* need_docs
* need_images
* need_metadata
* location_id
* location_name
* intent

Output:

* kế hoạch retrieval gồm:

  * shouldSearchDocs
  * shouldSearchImages
  * shouldGetMetadata
  * finalLocationId
  * topKDocs
  * topKImages

8. Embedding cho retrieval

Khi need_docs = true:

* Encode rewrite_query bằng BGE-M3.
* Gọi docsRepository.searchDocsByTextVector({
  textVector,
  locationId,
  topK
  })

Khi need_images = true:

* Phải dùng hybrid image search bằng text.
* Không dùng CAPTION_COLLECTION riêng.
* Không chỉ search caption_vector.
* Phải search 2 nhánh trong cùng collection image_collection.

Cụ thể:

1. Lấy rewrite_query.
2. Tạo siglipTextVector bằng SigLIP text encoder.
3. Tạo bgeTextVector bằng BGE-M3 text embedding.
4. Gọi:

imageRepository.hybridSearchImagesByText({
queryText: rewrite_query,
siglipTextVector,
bgeTextVector,
locationId,
topK: TOP_K_IMAGES,
weights: {
siglip: 0.5,
caption: 0.5
}
})

Trong đó:

* Nhánh SigLIP:

  * search collection image_collection
  * vector name = image_vector
  * query vector = siglipTextVector

* Nhánh BGE-M3:

  * search collection image_collection
  * vector name = caption_vector
  * query vector = bgeTextVector

Nếu need_metadata = true:

* Gọi locationRepository.getLocationById(locationId)

9. Result Fusion

Tạo fusionService.

Input:

* user message
* rewrite_query
* docs
* images
* metadata
* retrieval plan

Output:

* fused context cho Answer Generator:

  * question
  * rewrite_query
  * location metadata
  * relevant docs chunks
  * related images
  * retrieval debug

10. Answer Generator

Tạo llm/answerGenerator.

Input:

* original message
* rewrite_query
* metadata
* docs
* images

Yêu cầu:

* Trả lời bằng tiếng Việt.
* Không bịa ngoài dữ liệu retrieval.
* Nếu thiếu dữ liệu thì nói chưa có đủ thông tin.
* Nếu intent = image_search thì câu trả lời nên ngắn, kèm danh sách ảnh trả về cho FE.
* Nếu có images thì response data.images phải có ảnh đã chuẩn hóa.
* Nếu có metadata thì response data.location phải có metadata.

11. Format Response

Response phải theo ApiResponse contract:

{
"success": true,
"status": "ok",
"error_code": null,
"message": null,
"data": {
"session_id": "...",
"input_type": "text_only",
"pipeline": "text_only_pipeline",
"answer": {
"text": "...",
"markdown": true
},
"location": {},
"images": [],
"retrieval": {
"rewrite_query": "...",
"need_docs": true,
"need_images": true,
"need_metadata": true,
"is_follow_up": false,
"top_k_docs": 5,
"top_k_images": 5
},
"debug": {
"docs_count": 0,
"images_count": 0,
"used_collections": [
"location_info",
"docs_embedding",
"image_collection"
]
},
"suggested_questions": []
}
}

12. Update Conversation Context

Chỉ update khi status = ok.

Cập nhật:

* old_input = message
* old_rewrite_query = rewrite_query
* active_location_id = location_id nếu có
* active_location_name = location_name nếu có
* last_returned_images = images nếu có
* last_text_place_id = location_id nếu có
* last_conflict = null nếu không có conflict

13. Test cases

Sau khi code xong, hướng dẫn tôi test các case:

A. Text hỏi thông tin:

* "Biển Quy Hòa có gì đẹp?"

Expected:

* input_type = text_only
* pipeline = text_only_pipeline
* need_docs = true
* có answer

B. Follow-up:

* Sau câu trên, hỏi tiếp:
  "Ở đó có gì chơi?"

Expected:

* is_follow_up = true
* rewrite_query có tên địa điểm rõ ràng
* dùng context active_location_id

C. Text tìm ảnh:

* "Cho tôi xem ảnh Kỳ Co"

Expected:

* need_images = true
* gọi hybridSearchImagesByText
* search cả image_vector và caption_vector trong image_collection
* response có data.images

D. Out of domain:

* "Bạn sửa code Python giúp tôi"

Expected:

* status = out_of_scope
* error_code = TEXT_NOT_TRAVEL_RELATED
* không search Qdrant
* không update context

Sau khi code xong:

1. Liệt kê file đã tạo/sửa.
2. Giải thích ngắn luồng chạy.
3. Ghi rõ cách test bằng Postman/curl.
4. Không làm image_only pipeline.
5. Không làm image_text pipeline.

Sau khi lấy images từ:
imageRepository.hybridSearchImagesByText(...)

Bắt buộc gọi:
s3Service.attachImageUrls(images)

Yêu cầu:

Mỗi image trả về frontend phải có image_url.
image_url được tạo từ payload.s3_path.
s3_path đã chứa bucket và đường dẫn file.
Backend parse:
bucket = phần đầu tiên của s3_path
s3_key = phần còn lại sau bucket
Không trả s3:// trực tiếp cho frontend để hiển thị.
Frontend chỉ render ảnh bằng image_url.

Response data.images item gồm:

image_id
title_name
image_url
s3_path
s3_bucket
s3_key
caption
caption_vi
caption_en
location_id
location_key
location_name
final_score
siglip_score
caption_score
sources
rank
sau khi làm song phase này hãy chỉ tôi cách chạy vè test

[ ] Phase 6 - Thay mock Gemini bằng Gemini thật
Tiếp tục từ code hiện tại.

Chỉ thay mock LLM bằng Gemini thật cho Text Understanding và Answer Generator.

Yêu cầu:
- Tạo geminiClient.ts
- Dùng GEMINI_API_KEY và GEMINI_MODEL từ env
- Text Understanding phải trả JSON đúng schema:
  rewrite_query
  need_docs
  need_images
  need_metadata
  location_id
  location_name
  is_follow_up
  intent

- Nếu Gemini trả sai JSON thì handle lỗi:
  LLM_CLASSIFICATION_ERROR

- Answer Generator trả lời tiếng Việt.
- Không bịa ngoài dữ liệu retrieval.
- Nếu thiếu docs thì nói chưa có đủ dữ liệu.

Không đụng image_only pipeline.
Không đụng image_text pipeline.
Không làm frontend.

Sau khi xong, hướng dẫn test lại text only.

[ ] Phase 7 - Image only pipeline
Tiếp tục từ code hiện tại.

Bây giờ chỉ implement luồng 2: Image Only Pipeline.

Dựa theo file:
architecture_2_image_only_simple.json

Yêu cầu:
- Chỉ xử lý input_type = image_only.
- Không sửa logic text_only nếu không cần.
- Không code image_text.

Image Only Pipeline gồm:
1. Nhận image upload
2. Encode image bằng SigLIP service
3. Search image_collection bằng image_vector
4. Confidence Guard
5. Lấy matched image_id, location_id
6. Get location_info
7. Tạo default_query:
   "Đây là địa điểm nào và thông tin tổng quan là gì?"
8. Search text_collection với filter location_id
9. Result Fusion
10. Gemini Answer Generator
11. Format response
12. Update context

Nếu chưa tích hợp SigLIP thật, hãy tạo interface ImageEmbeddingService và mock trước.
Không lưu ảnh local lâu dài, chỉ xử lý tạm thời.
Không tạo Docker Qdrant.

Sau khi gọi:
imageRepository.searchImagesByImageVector(...)

Bắt buộc gọi:
s3Service.attachImageUrls(matchedImages)

Yêu cầu:

matched image và related images nếu có phải có image_url.
image_url được tạo từ payload.s3_path.
Không trả s3:// trực tiếp cho frontend.
Nếu image_url = null thì vẫn trả metadata địa điểm, không làm crash pipeline.

Response ảnh cần có:

image_id
title_name
image_url
s3_path
s3_bucket
s3_key
caption
caption_vi
caption_en
location_id
location_key
location_name
score
rank

Sau khi xong, hướng dẫn test bằng Postman với image upload.

[ ] Phase 8 - Image + Text Pipeline, dùng Hybrid Search khi cần ảnh
Tiếp tục từ code hiện tại.

Bây giờ implement PHASE 8: Image + Text Pipeline.

Dựa theo kiến trúc:
architecture_3_text_image_specific_question.json

Mục tiêu:

* Chỉ xử lý input_type = "image_text".
* Giữ nguyên text_only pipeline đã chạy được.
* Giữ nguyên image_only pipeline nếu đã có.
* Không refactor lớn làm hỏng pipeline cũ.
* Không làm frontend.
* Không tạo Docker Qdrant.
* Không tạo collection Qdrant.
* Không tạo CAPTION_COLLECTION riêng.

Luồng này dùng khi user gửi cả ảnh và text.

Ví dụ:

* User gửi ảnh Kỳ Co + "Ở đây có gì chơi?"
* User gửi ảnh Quy Hòa + "Chỗ này đẹp không?"
* User gửi ảnh Quy Hòa + "Eo Gió có gì chơi?"
* User gửi ảnh + "Cho tôi xem thêm ảnh chỗ này"
* User gửi ảnh + "Địa điểm này ở đâu?"

Các collection trong Qdrant:

* location_info
* docs_embedding
* image_collection

Quan trọng:
Collection ảnh chỉ có một collection duy nhất:

* image_collection

Trong image_collection có 2 vector name:

* image_vector
* caption_vector

Không dùng CAPTION_COLLECTION riêng.

Các bước cần implement:

1. POST /api/chat nhận image_text

Input:

* session_id: string
* message: string
* image: file

Input Router đã phân loại:

* input_type = "image_text"

Nếu input_type không phải image_text:

* Không xử lý trong pipeline này.

2. Load Conversation Context

Load context theo session_id.

Context có thể gồm:

* old_input
* old_rewrite_query
* active_location_id
* active_location_name
* last_image_place_id
* last_text_place_id
* last_returned_images
* last_conflict

3. Image Understanding / Image Matching

Mục tiêu:

* Dùng ảnh để xác định địa điểm trong ảnh.

Các bước:

1. Nhận file ảnh.
2. Encode ảnh bằng SigLIP image encoder.
3. Gọi imageRepository.searchImagesByImageVector({
   imageVector,
   topK: TOP_K_IMAGES
   })

Yêu cầu repository:

* Search collection image_collection.
* Vector name = image_vector.
* Query vector = SigLIP image vector.
* Trả top images kèm:

  * image_id
  * path
  * caption
  * location_id
  * location_name
  * score
  * rank

4. Confidence Guard

Dùng top1_score để quyết định:

Nếu top1_score >= IMAGE_MATCH_THRESHOLD:

* Ảnh hợp lệ.
* image_place_id = top1.location_id.
* image_place_name = top1.location_name.

Nếu IMAGE_LOW_CONFIDENCE_THRESHOLD <= top1_score < IMAGE_MATCH_THRESHOLD:

* Trả:

  * success = false
  * status = "low_confidence"
  * error_code = "LOW_CONFIDENCE_MATCH"
  * data.candidate_locations = top candidates
* Không chạy tiếp LLM answer.
* Không update context.

Nếu top1_score < IMAGE_LOW_CONFIDENCE_THRESHOLD:

* Trả:

  * success = false
  * status = "out_of_scope"
  * error_code = "IMAGE_NOT_TRAVEL_RELATED"
* Không chạy tiếp.
* Không update context.

5. Text Domain Guard

Sau khi ảnh hợp lệ, kiểm tra text.

Text hợp lệ:

* "Ở đây có gì chơi?"
* "Chỗ này đẹp không?"
* "Địa điểm này ở đâu?"
* "Cho tôi xem thêm ảnh chỗ này"
* "Eo Gió có gì chơi?"
* "Biển Quy Hòa có gì đẹp?"

Text ngoài domain:

* "Sửa code giúp tôi"
* "Giải bài toán này"
* "Tư vấn laptop"

Nếu text ngoài domain:

* Trả:

  * success = false
  * status = "out_of_scope"
  * error_code = "TEXT_NOT_TRAVEL_RELATED"
* Không search docs/images thêm.
* Không update context.

Lưu ý:
Với image_text, các câu như:

* "Ở đây có gì chơi?"
* "Chỗ này đẹp không?"
* "Địa điểm này ở đâu?"
  là hợp lệ vì ảnh đã cung cấp ngữ cảnh image_place_id.

6. LLM Text Understanding

Input cho LLM:

* message
* image_place_id
* image_place_name
* conversation context:

  * old_input
  * old_rewrite_query
  * active_location_id
  * active_location_name
  * last_image_place_id
  * last_text_place_id

Output JSON bắt buộc:

{
"rewrite_query": "string",
"need_docs": true,
"need_images": false,
"need_metadata": true,
"image_place_id": "string | null",
"image_place_name": "string | null",
"text_place_id": "string | null",
"text_place_name": "string | null",
"final_place_id": "string | null",
"final_place_name": "string | null",
"is_reference_question": true,
"is_specific_place_question": false,
"intent": "overview | activity | image_search | metadata | location_lookup | comparison | unknown"
}

Giải thích:

* image_place_id: địa điểm nhận diện từ ảnh.
* text_place_id: địa điểm được nhắc rõ trong text, nếu có.
* final_place_id: địa điểm cuối cùng dùng để retrieval.
* is_reference_question = true nếu text kiểu:

  * "ở đây"
  * "chỗ này"
  * "địa điểm này"
  * "nơi này"
* is_specific_place_question = true nếu text nhắc rõ địa điểm khác:

  * "Eo Gió có gì chơi?"
  * "Kỳ Co ở đâu?"

7. Resolve image_place_id và text_place_id

Áp dụng logic:

Case A: Câu hỏi tham chiếu theo ảnh

Ví dụ:

* Ảnh = Kỳ Co
* Text = "Ở đây có gì chơi?"

Logic:

* is_reference_question = true
* text_place_id = null
* final_place_id = image_place_id
* rewrite_query = "Kỳ Co có gì chơi?"

Case B: Text nhắc đúng cùng địa điểm với ảnh

Ví dụ:

* Ảnh = Kỳ Co
* Text = "Kỳ Co có gì chơi?"

Logic:

* text_place_id = image_place_id
* final_place_id = image_place_id
* rewrite_query = "Kỳ Co có gì chơi?"

Case C: Text nhắc địa điểm khác ảnh

Ví dụ:

* Ảnh = Quy Hòa
* Text = "Eo Gió có gì chơi?"

Logic:

* image_place_id = quy_hoa
* text_place_id = eo_gio
* final_place_id = text_place_id
* rewrite_query = "Eo Gió có gì chơi?"
* Giữ image_place_id trong debug/context.
* Retrieval docs/images/metadata theo final_place_id.
* Có thể ghi debug:
  conflict_type = "image_text_place_mismatch"

Case D: Text hỏi so sánh

Ví dụ:

* Ảnh = Kỳ Co
* Text = "Chỗ này so với Eo Gió thì nơi nào đẹp hơn?"

Logic:

* image_place_id = ky_co
* text_place_id = eo_gio
* intent = comparison
* final_place_id có thể là null hoặc image_place_id tùy thiết kế.
* Retrieval nên lấy dữ liệu cho cả 2 địa điểm nếu repository hỗ trợ.
* Nếu chưa hỗ trợ comparison, trả need_clarification hoặc trả lời giới hạn theo dữ liệu có.

8. Rewrite Query + Need Flags

Dựa vào LLM output:

Nếu intent = "image_search":

* need_images = true
* need_metadata = true
* need_docs có thể false hoặc true tùy câu hỏi.

Nếu intent = "activity" hoặc "overview":

* need_docs = true
* need_metadata = true
* need_images có thể true nếu muốn minh họa.

Nếu intent = "metadata":

* need_metadata = true
* need_docs có thể true nếu metadata thiếu.

Nếu text là:

* "Cho tôi xem thêm ảnh chỗ này"
* "Có ảnh đẹp hơn không?"
* "Cho tôi xem ảnh nơi này"

Thì bắt buộc:

* need_images = true
* final_place_id = image_place_id
* rewrite_query có tên địa điểm rõ ràng.

9. Retrieval Planner

Input:

* rewrite_query
* need_docs
* need_images
* need_metadata
* image_place_id
* text_place_id
* final_place_id
* intent

Output:

* shouldSearchDocs
* shouldSearchImages
* shouldGetMetadata
* finalLocationId
* topKDocs
* topKImages
* conflict info nếu có

10. Retrieval Execution

A. Nếu need_docs = true

* Encode rewrite_query bằng BGE-M3.
* Gọi:

docsRepository.searchDocsByTextVector({
textVector,
locationId: final_place_id,
topK: TOP_K_DOCS
})

B. Nếu need_metadata = true

* Gọi:

locationRepository.getLocationById(final_place_id)

C. Nếu need_images = true

Phải dùng hybrid image search bằng text.

Không dùng CAPTION_COLLECTION riêng.
Không chỉ search caption_vector.
Phải search 2 nhánh trong cùng collection image_collection.

Các bước:

1. Lấy rewrite_query.
2. Encode rewrite_query bằng SigLIP text encoder:
   siglipTextVector
3. Encode rewrite_query bằng BGE-M3:
   bgeTextVector
4. Gọi:

imageRepository.hybridSearchImagesByText({
queryText: rewrite_query,
siglipTextVector,
bgeTextVector,
locationId: final_place_id,
topK: TOP_K_IMAGES,
weights: {
siglip: 0.5,
caption: 0.5
}
})

Trong đó:

* Nhánh 1:

  * collection = image_collection
  * vector name = image_vector
  * query vector = siglipTextVector

* Nhánh 2:

  * collection = image_collection
  * vector name = caption_vector
  * query vector = bgeTextVector

Output images phải có:

* image_id
* path hoặc image_url nếu đã xử lý S3
* caption
* location_id
* location_name
* final_score
* siglip_score
* caption_score
* sources
* rank

11. Result Fusion

Tạo fused context gồm:

* original message
* rewrite_query
* image_place_id
* image_place_name
* text_place_id
* text_place_name
* final_place_id
* final_place_name
* location metadata
* relevant docs
* related images
* conflict info nếu có

12. Gemini Answer Generator

Input:

* original message
* rewrite_query
* metadata
* docs
* images
* image/text place resolution

Yêu cầu:

* Trả lời tiếng Việt.
* Không bịa ngoài dữ liệu retrieval.
* Nếu thiếu dữ liệu thì nói chưa có đủ thông tin.
* Nếu text hỏi theo ảnh, trả lời theo địa điểm trong ảnh.
* Nếu text nhắc địa điểm khác ảnh, trả lời theo địa điểm trong text và có thể nói ngắn gọn:
  "Ảnh bạn gửi có vẻ liên quan đến Quy Hòa, nhưng câu hỏi của bạn đang hỏi về Eo Gió, nên mình trả lời theo Eo Gió."
* Nếu intent = image_search, trả lời ngắn và trả ảnh trong data.images.

13. Format Response

Response success phải theo ApiResponse contract:

{
"success": true,
"status": "ok",
"error_code": null,
"message": null,
"data": {
"session_id": "...",
"input_type": "image_text",
"pipeline": "image_text_pipeline",
"answer": {
"text": "...",
"markdown": true
},
"location": {},
"images": [],
"retrieval": {
"rewrite_query": "...",
"need_docs": true,
"need_images": true,
"need_metadata": true,
"is_follow_up": false,
"top_k_docs": 5,
"top_k_images": 5
},
"debug": {
"matched_image_id": "...",
"image_place_id": "...",
"image_place_name": "...",
"text_place_id": "...",
"text_place_name": "...",
"final_place_id": "...",
"final_place_name": "...",
"image_similarity_score": 0.91,
"docs_count": 5,
"images_count": 5,
"used_collections": [
"location_info",
"text_collection",
"image_collection"
],
"hybrid_image_search": {
"used": true,
"branches": [
"siglip_text_to_image_vector",
"caption_bge_m3_vector"
]
},
"conflict": null
},
"suggested_questions": []
}
}

14. Update Conversation Context

Chỉ update nếu status = ok.

Cập nhật:

* old_input = message
* old_rewrite_query = rewrite_query
* active_location_id = final_place_id
* active_location_name = final_place_name
* last_image_place_id = image_place_id
* last_text_place_id = text_place_id
* last_returned_images = images
* last_conflict = conflict nếu có

Không update context nếu:

* out_of_scope
* low_confidence
* error

15. Test cases

Sau khi code xong, hướng dẫn tôi test bằng Postman/curl:

A. Ảnh Kỳ Co + "Ở đây có gì chơi?"

Expected:

* input_type = image_text
* pipeline = image_text_pipeline
* image_place_id = ky_co
* final_place_id = ky_co
* rewrite_query = "Kỳ Co có gì chơi?"
* need_docs = true
* status = ok

B. Ảnh Quy Hòa + "Cho tôi xem thêm ảnh chỗ này"

Expected:

* need_images = true
* gọi hybridSearchImagesByText
* search cả image_vector và caption_vector trong image_collection
* filter location_id = quy_hoa
* response có data.images

C. Ảnh Quy Hòa + "Eo Gió có gì chơi?"

Expected:

* image_place_id = quy_hoa
* text_place_id = eo_gio
* final_place_id = eo_gio
* retrieval theo eo_gio
* debug có conflict image_text_place_mismatch

D. Ảnh không rõ địa điểm

Expected:

* status = low_confidence hoặc out_of_scope
* không update context

E. Ảnh địa điểm + text ngoài domain

Input:

* ảnh Kỳ Co
* message = "Sửa code Python giúp tôi"

Expected:

* status = out_of_scope
* error_code = TEXT_NOT_TRAVEL_RELATED
* không retrieval docs/images thêm
* không update context

Sau khi code xong:

1. Liệt kê file đã tạo/sửa.
2. Giải thích ngắn image_text pipeline chạy như thế nào.
3. Ghi rõ cách test.
4. Không làm frontend.
5. Không tạo CAPTION_COLLECTION.
6. Không sửa hỏng text_only và image_only pipeline.

Với mọi danh sách ảnh lấy từ Qdrant:

matchedImages từ searchImagesByImageVector
relatedImages từ hybridSearchImagesByText

Đều phải gọi:
s3Service.attachImageUrls(images)

Yêu cầu:

data.images chỉ dùng image_url để frontend render.
image_url được tạo từ payload.s3_path.
s3_path đã chứa bucket và đường dẫn file.
Không yêu cầu payload.bucket.
Không yêu cầu payload.s3_key.
Không trả s3:// trực tiếp làm URL hiển thị.
Có thể giữ s3_path, s3_bucket, s3_key trong debug hoặc data.

Sau khi chạy song file này hướng dẫn tôi text và chạy
[ ] Phase 9 - Frontend
Tạo frontend ReactTS + Vite cho Travel AI Assistant.

Dựa theo file FRONTEND_ARCHITECTURE.md.

Yêu cầu:
- Chat UI
- Upload image
- Gửi multipart/form-data tới POST /api/chat
- Render theo ApiResponse contract:
  status = ok
  status = out_of_scope
  status = need_clarification
  status = low_confidence
  status = error

Component cần có:
- ChatPage
- ChatWindow
- ChatInput
- MessageBubble
- ImageUploadBox
- BotMessage
- UserMessage
- ImageGallery
- LocationInfoPanel
- SuggestedQuestions
- ErrorMessage

Không sửa backend.

Frontend không tự xử lý S3.
Frontend không tự parse s3_path.
Frontend không dùng s3:// để render ảnh.
Frontend chỉ render:

Nếu image_url null:

hiển thị placeholder ảnh
hoặc warning "Không thể tải ảnh"

ImageGallery và ImageCard nhận dữ liệu:

image_url
caption
location_name
final_score hoặc score
rank

Sau khi xong, hướng dẫn chạy frontend.
[ ] Phase 10 - Integration test