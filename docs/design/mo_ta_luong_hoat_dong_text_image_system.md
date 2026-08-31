# Mô tả luồng hoạt động hệ thống Travel AI Assistant

Tài liệu kỹ thuật backend theo code hiện tại

Phạm vi: mô tả luồng xử lý của endpoint POST /api/chat với ba hướng text_only, image_only và text_image. Tài liệu chỉ dựa trên code backend hiện có trong apps/api, không mô tả thêm chức năng chưa thấy trong code.

## Mục lục

- 1. Tổng quan kiến trúc xử lý request
- 2. text_only
- 3. image_only
- 4. text_image
- 5. Ghi chú về phần chưa thấy rõ trong code

## 1. Tổng quan kiến trúc xử lý request

Backend là NodeJS + Express thuần JavaScript. File src/server.js khởi động Express app theo appConfig.port và appConfig.apiPrefix. File src/app.js khai báo trực tiếp endpoint POST ${appConfig.apiPrefix}/chat bằng multer.memoryStorage() với upload.single("image"). Trong code hiện tại không thấy file router riêng cho chat; route được gắn trực tiếp trong app.js.

### Luồng vào chung của /api/chat:

1. Client gửi multipart/form-data tới POST /api/chat. Các field chính gồm session_id, message và image.
2. app.js dùng multer đọc file ảnh vào req.file theo bộ nhớ tạm, không lưu file dài hạn trên disk.
3. ChatController.handle trong src/controllers/chat.controller.js gọi inputRouterService.route() với sessionId=req.body.session_id, message=req.body.message và image=req.file.
4. InputRouterService trong src/services/inputRouter.service.js chuẩn hóa message bằng trim(), kiểm tra có message và có image hay không, sau đó phân loại input_type.
5. Nếu không có cả message lẫn image, controller trả errorResponse với error_code EMPTY_INPUT, HTTP 400.
6. Nếu input_type là text_only, controller gọi textOnlyPipeline.run(). Nếu là image_only, controller gọi imageOnlyPipeline.run(). Nếu là image_text, controller gọi imageTextPipeline.run().

### Các kiểu input_type trong code:

| input_type | Điều kiện phân loại | Pipeline được gọi |
| --- | --- | --- |
| text_only | Có message, không có image | TextOnlyPipeline trong src/pipelines/text-only.pipeline.js |
| image_only | Có image, không có message | ImageOnlyPipeline trong src/pipelines/image-only.pipeline.js |
| image_text | Có cả message và image | ImageTextPipeline trong src/pipelines/image-text.pipeline.js |
| empty_input | Không có message và không có image | Không gọi pipeline, trả EMPTY_INPUT |

Lưu ý đặt tên: yêu cầu tài liệu dùng heading text_image. Trong backend hiện tại, input_type thực tế trong InputRouterService và ChatController là image_text. Vì vậy phần text_image dưới đây mô tả đúng luồng code image_text.

Response contract chung được tạo bởi src/utils/responseFormatter.js gồm các trường: success, status, error_code, message, data, suggested_questions. Các status hiện có là ok, error, out_of_scope, need_clarification và low_confidence.

### Cấu hình Qdrant và model theo code hiện tại:

| Nhóm | Tên trong code | Giá trị/chức năng |
| --- | --- | --- |
| Qdrant collection | appConfig.qdrant.collections.location | location_info |
| Qdrant collection | appConfig.qdrant.collections.image | image_collection |
| Qdrant collection | appConfig.qdrant.collections.text | text_collection |
| Vector text docs | TEXT_VECTOR_NAME | text_vector |
| Vector ảnh | IMAGE_VECTOR_NAME | image_vector |
| Vector caption ảnh | CAPTION_VECTOR_NAME | caption_vector |
| Text embedding | BgeM3EmbeddingService | onnx-community/bge-m3-ONNX, dimension 1024 |
| Image/Text-to-image embedding | ImageEmbeddingService và SiglipTextEmbeddingService | Xenova/siglip-base-patch16-384, dimension 768 |
| LLM | GeminiClient | Dùng GEMINI_API_KEYS hoặc GEMINI_API_KEY và GEMINI_MODEL |

---

## 2. text_only

Luồng này xử lý trường hợp người dùng chỉ nhập văn bản. Điều kiện vào là InputRouterService phân loại input_type=text_only và có message sau khi trim() và không có req.file.

### Các bước xử lý

1. ChatController.handle nhận routeResult từ inputRouterService.route() và gọi textOnlyPipeline.run({ sessionId, message, inputType }).
2. TextOnlyPipeline kiểm tra inputType. Nếu không phải text_only thì trả PIPELINE_NOT_IMPLEMENTED.
3. Pipeline lấy context hội thoại bằng contextService.getContext(sessionId). Context chứa old_input, old_rewrite_query, active_location_id, active_location_name, last_returned_images, last_image_place_id, last_text_place_id, last_conflict và pending_question.
4. Pipeline gọi textDomainGuard.check(message, context). File src/guards/textDomain.guard.js chỉ chặn các trường hợp chắc chắn ngoài phạm vi du lịch dựa trên OUT_OF_DOMAIN_KEYWORDS. Nếu message rỗng thì trả EMPTY_INPUT. Nếu ngoài phạm vi thì trả outOfScopeResponse với error_code TEXT_NOT_TRAVEL_RELATED. Các câu hỏi mơ hồ có context vẫn được cho đi tiếp.
5. Pipeline gọi textUnderstandingService.understand({ message, context }). Khi Gemini được cấu hình, TextUnderstandingService dùng GeminiClient.generateJson() để sinh JSON đúng TEXT_UNDERSTANDING_SCHEMA.
6. Schema text understanding bắt buộc có các trường rewrite_query, need_docs, need_images, need_metadata, location_id, location_name, is_follow_up và intent. intent hợp lệ gồm overview, activity, image_search, metadata, location_lookup, unknown.
7. Nếu Gemini trả JSON sai hoặc thiếu field, validateLlmResult() ném LlmClassificationError và pipeline trả errorResponse với error_code LLM_CLASSIFICATION_ERROR.
8. Sau khi hiểu câu hỏi, pipeline gọi referenceResolver.resolve(). Service này xử lý follow-up dựa trên context, ví dụ tham chiếu active_location_id/active_location_name hoặc ảnh theo rank trong last_returned_images.
9. Pipeline gọi retrievalPlanner.plan(resolvedUnderstanding). Planner chuyển need_docs, need_images, need_metadata thành shouldSearchDocs, shouldSearchImages, shouldGetMetadata; đồng thời lấy topKDocs và topKImages từ appConfig.retrieval.
10. Nếu shouldSearchDocs=true, pipeline gọi bgeM3EmbeddingService.embedText(resolvedUnderstanding.rewrite_query) để tạo vector BGE-M3, sau đó gọi textRepository.searchDocsByTextVector(). Repository tìm trong collection text_collection, vector text_vector, có filter location_id nếu plan.finalLocationId tồn tại.
11. Nếu chưa có finalLocationId nhưng docs trả về có location_id, pipeline lấy location_id đầu tiên từ docs để dùng cho các bước sau.
12. Nếu shouldSearchImages=true, pipeline tạo hoặc tái sử dụng bgeTextVector, gọi siglipTextEmbeddingService.embedText() để tạo SigLIP text vector. Sau đó imageRepository.hybridSearchImagesByText() tìm ảnh trong image_collection theo hai nhánh: image_vector với SigLIP text vector và caption_vector với BGE-M3 vector. Luồng text_only dùng weights siglip=0.3 và caption=0.7.
13. Kết quả ảnh hybrid được merge theo image_id hoặc s3_path, tính final_score, xếp rank rồi được truyền qua s3Service.attachImageUrls(). Service này parse s3_path thành s3_bucket và s3_key, sau đó tạo image_url theo S3_URL_MODE public hoặc presigned.
14. Nếu chưa có finalLocationId nhưng images trả về có location_id, pipeline lấy location_id đầu tiên từ images.
15. Nếu shouldGetMetadata=true và có finalLocationId, pipeline gọi locationRepository.getLocationById() để lấy metadata trong collection location_info bằng scrollPoints với filter location_id.
16. Pipeline xác định finalLocationId và finalLocationName bằng getFirstLocationId() và getFirstLocationName() từ metadata, understanding, docs hoặc images.
17. Pipeline gọi fusionService.fuse() để gom message, rewrite_query, docs, images, metadata, plan và debug thành fusedContext. Trong code hiện tại fusedContext chủ yếu là object gom dữ liệu, chưa có thuật toán fusion phức tạp.
18. Pipeline gọi answerGenerator.generate(). AnswerGenerator chỉ dùng dữ liệu retrieval JSON trong prompt gửi Gemini, yêu cầu trả lời tiếng Việt, không bịa ngoài dữ liệu, không dùng markdown bold/italic và không dùng ký tự **. Nếu intent không phải image_search mà docs rỗng, AnswerGenerator trả câu báo chưa có đủ dữ liệu mà không gọi Gemini.
19. Pipeline tạo data response gồm session_id, input_type=text_only, pipeline=text_only_pipeline, answer, location, images, retrieval, debug và suggested_questions.
20. contextService.updateOnSuccess() cập nhật old_input, old_rewrite_query, active_location_id, active_location_name, last_returned_images, last_text_place_id và last_conflict=null.
21. Pipeline trả okResponse(data) với HTTP 200. Nếu retrieval từng phần lỗi, pipeline ghi retrieval_errors trong debug nhưng vẫn có thể tiếp tục nếu còn đủ dữ liệu để sinh answer.

### Bảng tóm tắt text_only

| Mục | Nội dung |
| --- | --- |
| Input | multipart/form-data có session_id và message; không có image. |
| Thành phần xử lý chính | ChatController, InputRouterService, TextOnlyPipeline, TextDomainGuard, TextUnderstandingService, ReferenceResolver, RetrievalPlanner, BgeM3EmbeddingService, SiglipTextEmbeddingService, TextRepository, ImageRepository, LocationRepository, S3Service, FusionService, AnswerGenerator, ContextService. |
| Collection Qdrant sử dụng | text_collection khi need_docs=true; image_collection khi need_images=true; location_info khi need_metadata=true và có location_id. |
| Output trả về | ApiResponse status ok/out_of_scope/error/need_clarification. Khi ok, data có answer, location, images, retrieval, debug và suggested_questions. |

---

## 3. image_only

Luồng này xử lý trường hợp người dùng chỉ gửi ảnh. Điều kiện vào là InputRouterService phân loại input_type=image_only và có req.file và không có message.

### Các bước xử lý

1. ChatController.handle gọi imageOnlyPipeline.run({ sessionId, inputType, image }).
2. ImageOnlyPipeline kiểm tra inputType. Nếu không phải image_only thì trả PIPELINE_NOT_IMPLEMENTED.
3. Pipeline gọi validateUploadedImage(image). Hàm này yêu cầu image có buffer và mimetype bắt đầu bằng image/. Nếu thiếu ảnh trả EMPTY_INPUT, nếu không phải ảnh trả UNSUPPORTED_FILE_TYPE.
4. Pipeline gọi imageEmbeddingService.embedImage(image). Service này dùng SiglipImageModelClient trong src/embeddings/embedding.client.js để decode ảnh bằng RawImage, chạy SiglipVisionModel và trả vector ảnh dimension 768.
5. Pipeline gọi imageRepository.searchImagesByImageVector({ imageVector, topK }). Repository tìm trong collection image_collection, vector name image_vector, source image_vector, topK lấy từ appConfig.retrieval.topKImages.
6. Ngay sau search ảnh, pipeline bắt buộc gọi s3Service.attachImageUrls(rawMatches). Service này đọc payload.s3_path, parse thành s3_bucket và s3_key, rồi tạo image_url. Nếu không tạo được URL thì image_url có thể là null nhưng pipeline vẫn tiếp tục theo metadata.
7. Pipeline gọi confidenceGuard.checkImageMatch(matchedImages). Guard dùng imageMatchThreshold và imageLowConfidenceThreshold từ appConfig.retrieval. Nếu score ảnh đầu tiên >= imageMatchThreshold thì passed=true. Nếu thấp hơn thì pipeline trả lowConfidenceResponse với error_code LOW_CONFIDENCE_MATCH và danh sách candidate images.
8. Nếu match đủ tin cậy, pipeline lấy matchedImage=matchedImages[0] và locationId từ matchedImage.location_id. Nếu không có location_id, pipeline trả lowConfidenceResponse với error_code IMAGE_LOCATION_NOT_FOUND.
9. Pipeline gọi locationRepository.getLocationById(locationId) để lấy metadata địa điểm từ collection location_info. Nếu lỗi Qdrant, lỗi được ghi vào retrievalErrors.
10. Pipeline tạo default query bằng hằng IMAGE_ONLY_DEFAULT_QUERY: "Đây là địa điểm nào và thông tin tổng quan là gì?".
11. Pipeline gọi bgeM3EmbeddingService.embedText(IMAGE_ONLY_DEFAULT_QUERY) để tạo vector text, sau đó gọi textRepository.searchDocsByTextVector({ textVector, locationId, topK }) để tìm tài liệu trong text_collection, vector text_vector, có filter location_id đúng với địa điểm đã match từ ảnh.
12. Pipeline gọi fusionService.fuse() để gom default query, docs, matchedImages, metadata, plan và debug.
13. Pipeline gọi answerGenerator.generate() với intent overview. Nếu docs rỗng, AnswerGenerator trả câu báo chưa có đủ dữ liệu trong hệ thống. Nếu có docs, AnswerGenerator gọi Gemini để sinh câu trả lời tiếng Việt dựa trên retrieval JSON.
14. Pipeline tạo suggested_questions theo locationName nếu có, ví dụ hỏi địa điểm có gì đẹp, có gì chơi hoặc xem thêm ảnh.
15. Pipeline tạo data gồm session_id, input_type=image_only, pipeline=image_only_pipeline, default_query, answer, location, matched_image, images, retrieval và debug. debug có uploaded_image, docs_count, images_count, top_score, used_collections và retrieval_errors.
16. contextService.updateOnSuccess() cập nhật old_input="[image_only]", old_rewrite_query=IMAGE_ONLY_DEFAULT_QUERY, active_location_id, active_location_name, last_returned_images, last_text_place_id và last_conflict=null.
17. Pipeline trả okResponse(data) với HTTP 200.

### Bảng tóm tắt image_only

| Mục | Nội dung |
| --- | --- |
| Input | multipart/form-data có session_id và image; không có message. Image được multer đưa vào req.file trong bộ nhớ. |
| Thành phần xử lý chính | ChatController, InputRouterService, ImageOnlyPipeline, ImageEmbeddingService, ImageRepository, S3Service, ConfidenceGuard, LocationRepository, BgeM3EmbeddingService, TextRepository, FusionService, AnswerGenerator, ContextService. |
| Collection Qdrant sử dụng | image_collection để match ảnh bằng image_vector; location_info để lấy metadata theo location_id; text_collection để lấy docs bằng text_vector với filter location_id. |
| Output trả về | Nếu score thấp: status low_confidence. Nếu đủ tin cậy: status ok, data có answer, location, matched_image, images, retrieval, debug và suggested_questions. |

---

## 4. text_image

Luồng này mô tả trường hợp người dùng gửi cả văn bản và ảnh. Trong code backend hiện tại, tên input_type là image_text và pipeline là image_text_pipeline. Heading text_image được dùng theo yêu cầu tài liệu, nhưng tất cả tên class/file/hàm bên dưới giữ đúng theo code.

### Các bước xử lý

1. ChatController.handle nhận routeResult.input_type=image_text từ InputRouterService và gọi imageTextPipeline.run({ sessionId, message, inputType, image }).
2. ImageTextPipeline kiểm tra inputType. Nếu không phải image_text thì trả PIPELINE_NOT_IMPLEMENTED.
3. Pipeline gọi validateUploadedImage(image) dùng lại từ image-only.pipeline.js. Nếu thiếu ảnh hoặc mimetype không phải image/* thì trả EMPTY_INPUT hoặc UNSUPPORTED_FILE_TYPE.
4. Pipeline lấy context bằng contextService.getContext(sessionId) và khởi tạo retrievalDebug với used_collections ban đầu là image_collection.
5. Pipeline gọi imageEmbeddingService.embedImage(image) để tạo SigLIP image vector dimension 768.
6. Pipeline gọi imageRepository.searchImagesByImageVector() để tìm ảnh tương tự trong image_collection bằng vector image_vector.
7. Pipeline gọi s3Service.attachImageUrls(rawMatches) để bổ sung image_url, s3_bucket và s3_key từ payload.s3_path.
8. Pipeline gọi evaluateImageConfidence(matchedImages). Khác image_only, image_text tự phân biệt hai mức: nếu topScore < imageLowConfidenceThreshold thì trả outOfScopeResponse với error_code IMAGE_NOT_TRAVEL_RELATED; nếu topScore < imageMatchThreshold thì trả lowConfidenceResponse với error_code LOW_CONFIDENCE_MATCH; nếu đạt ngưỡng thì đi tiếp.
9. Pipeline lấy matchedImage=matchedImages[0] và imagePlace gồm location_id, location_name từ ảnh match. Nếu ảnh match không có location_id, pipeline trả lowConfidenceResponse với error_code IMAGE_LOCATION_NOT_FOUND.
10. Pipeline tạo imageContext bằng context hiện tại cộng với active_location_id, active_location_name, last_image_place_id và last_returned_images từ ảnh đã match.
11. Pipeline gọi textDomainGuard.check(message, imageContext). Nếu text chắc chắn ngoài phạm vi du lịch, pipeline trả outOfScopeResponse với error_code TEXT_NOT_TRAVEL_RELATED, nhưng vẫn có matched_image trong data debug.
12. Pipeline gọi imageTextUnderstandingService.understand({ message, imagePlace, context: imageContext }). Khi Gemini được cấu hình, service dùng GeminiClient.generateJson() theo IMAGE_TEXT_UNDERSTANDING_SCHEMA.
13. Schema image_text understanding bắt buộc có rewrite_query, need_docs, need_images, need_metadata, image_place_id, image_place_name, text_place_id, text_place_name, final_place_id, final_place_name, is_reference_question, is_specific_place_question và intent. intent hợp lệ gồm overview, activity, image_search, metadata, location_lookup, comparison, unknown.
14. Nếu Gemini trả JSON sai hoặc thiếu field, pipeline trả errorResponse với error_code LLM_CLASSIFICATION_ERROR.
15. Pipeline gọi enrichUnderstandingLocation(). Nếu understanding có text_place_name nhưng chưa có text_place_id, service gọi locationRepository.findLocationByName() để dò trong location_info. Hàm này scroll tối đa 200 điểm và so khớp normalizeText với location_name, location_key hoặc title_name.
16. Pipeline gọi imageTextResolver.resolve(). Resolver quyết định final_place_id/final_place_name từ địa điểm trong ảnh và địa điểm trong text. Nếu text nhắc địa điểm khác ảnh, resolver tạo conflict có conflict_type=image_text_place_mismatch. Nếu câu hỏi là tham chiếu kiểu "ở đây", "trong ảnh", resolver ưu tiên imagePlace.
17. Pipeline gọi buildPlan(resolved). Plan gồm shouldSearchDocs, shouldSearchImages, shouldGetMetadata, finalLocationId, finalLocationName, topKDocs, topKImages và intent.
18. Nếu shouldSearchDocs=true, pipeline gọi bgeM3EmbeddingService.embedText(resolved.rewrite_query) rồi textRepository.searchDocsByTextVector() trong text_collection bằng text_vector, filter theo finalLocationId nếu có.
19. Nếu shouldSearchImages=true, pipeline bật debug.hybrid_image_search.used=true và branches gồm siglip_text_to_image_vector, caption_bge_m3_vector. Pipeline tạo bgeTextVector nếu chưa có, tạo siglipTextVector bằng siglipTextEmbeddingService.embedText(), rồi gọi imageRepository.hybridSearchImagesByText() với weights siglip=0.5 và caption=0.5.
20. Hybrid image search trong ImageRepository tìm song song trong image_collection bằng image_vector cho SigLIP text-to-image và caption_vector cho BGE-M3 caption vector, sau đó merge kết quả, tính final_score và rank. Kết quả relatedImages được bổ sung image_url qua s3Service.attachImageUrls().
21. Nếu shouldGetMetadata=true và có finalLocationId, pipeline gọi locationRepository.getLocationById() để lấy metadata từ location_info.
22. Pipeline chọn responseImages: nếu plan.shouldSearchImages=true thì dùng relatedImages; nếu không thì trả về matchedImage ban đầu trong mảng images.
23. Pipeline xác định finalLocationName bằng getFinalLocationName() từ metadata, resolved, images hoặc docs.
24. Pipeline tạo responsePlan có thêm conflict, rồi gọi fusionService.fuse() để gom dữ liệu retrieval và resolution.
25. Pipeline gọi answerGenerator.generate() với resolution gồm image_place_id, image_place_name, text_place_id, text_place_name, final_place_id, final_place_name và conflict. Nếu conflict_type=image_text_place_mismatch, prompt có answer_hint yêu cầu nêu ngắn gọn ảnh và text đang nhắc hai địa điểm khác nhau rồi trả lời theo final_place_name.
26. Pipeline tạo data gồm session_id, input_type=image_text, pipeline=image_text_pipeline, answer, location, matched_image, images, retrieval, debug và suggested_questions. debug lưu matched_image_id, image_place_id/name, text_place_id/name, final_place_id/name, image_similarity_score, docs_count, images_count, used_collections, hybrid_image_search, retrieval_errors và conflict.
27. contextService.updateOnSuccess() cập nhật old_input, old_rewrite_query, active_location_id=resolved.final_place_id, active_location_name, last_image_place_id, last_text_place_id, last_returned_images và last_conflict.
28. Pipeline trả okResponse(data) với HTTP 200.

### Bảng tóm tắt text_image

| Mục | Nội dung |
| --- | --- |
| Input | multipart/form-data có session_id, message và image. Backend phân loại là input_type=image_text. |
| Thành phần xử lý chính | ChatController, InputRouterService, ImageTextPipeline, ImageEmbeddingService, ImageRepository, S3Service, TextDomainGuard, ImageTextUnderstandingService, ImageTextResolver, BgeM3EmbeddingService, SiglipTextEmbeddingService, TextRepository, LocationRepository, FusionService, AnswerGenerator, ContextService. |
| Collection Qdrant sử dụng | image_collection để match ảnh ban đầu bằng image_vector và tìm ảnh liên quan bằng hybrid search; text_collection để tìm docs bằng text_vector; location_info để dò/tải metadata địa điểm. |
| Output trả về | Có thể trả out_of_scope nếu ảnh hoặc text ngoài phạm vi, low_confidence nếu ảnh chưa đủ tin cậy, error nếu LLM/Qdrant lỗi nặng, hoặc ok với answer, location, matched_image, images, retrieval, debug và suggested_questions. |

---

## 5. Ghi chú về phần chưa thấy rõ trong code

- Không thấy file router riêng cho chat như src/routes/chat.routes.js; endpoint /api/chat đang được khai báo trực tiếp trong src/app.js.
- TravelQueryPipeline trong src/pipelines/travel-query.pipeline.js hiện là placeholder và không được ChatController dùng cho ba luồng chính.
- TextUnderstandingService và ImageTextUnderstandingService có fallback heuristic trong class, nhưng singleton đang dùng mặc định useFallbackWhenNotConfigured=false. Nghĩa là flow thực tế cần Gemini được cấu hình, trừ khi test hoặc code khác inject option fallback.
- FusionService hiện chỉ gom dữ liệu retrieval vào một object; chưa thấy thuật toán fusion nâng cao trong code.
- Tài liệu này dùng collection image_collection vì đó là giá trị mặc định trong appConfig hiện tại. Nếu .env đổi QDRANT_IMAGE_COLLECTION thì backend sẽ sử dụng giá trị từ .env.
