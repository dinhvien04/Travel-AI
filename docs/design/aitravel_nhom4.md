# BÁO CÁO DỰ ÁN HỆ THỐNG TRAVEL AI ASSISTANT

> **Hệ thống Trợ lý Du lịch Đa phương thức (Multimodal RAG)**
> Hỗ trợ hỏi đáp thông tin du lịch bằng Văn bản và Hình ảnh kết hợp Vector Database (Qdrant), Embedding (BGE-M3, SigLIP) và LLM (Gemini).

## CHƯƠNG 4: PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG

Chương này trình bày phần phân tích yêu cầu và thiết kế hệ thống cho ứng dụng Travel AI Assistant. Nội dung gồm frontend ReactTS + Vite trong apps/web và backend NodeJS + Express trong apps/api. Trọng tâm của chương là cách hệ thống tiếp nhận yêu cầu từ người dùng, phân loại dữ liệu đầu vào, truy xuất dữ liệu từ Qdrant, sử dụng embedding model và Gemini LLM để tạo câu trả lời, đồng thời chuẩn hóa response trả về frontend.

Endpoint xử lý hội thoại chính là POST /api/chat. Backend hỗ trợ ba tình huống đầu vào: người dùng chỉ nhập văn bản, chỉ gửi hình ảnh, hoặc gửi cả văn bản kèm hình ảnh. Trong code, ba loại này lần lượt là text_only, image_only và image_text.


### 4.1. Yêu cầu chức năng

Yêu cầu chức năng của Travel AI Assistant xoay quanh mục tiêu hỗ trợ người dùng tra cứu thông tin du lịch bằng ngôn ngữ tự nhiên và hình ảnh. Người dùng có thể đặt câu hỏi, gửi ảnh hoặc kết hợp cả hai. Hệ thống sẽ tự phân loại kiểu đầu vào, chọn pipeline xử lý phù hợp, truy xuất dữ liệu trong Qdrant và trả về câu trả lời theo một cấu trúc thống nhất.

Với chức năng hỏi bằng văn bản, người dùng có thể hỏi tổng quan về địa điểm, hỏi địa điểm ở đâu, hỏi có gì chơi hoặc yêu cầu xem hình ảnh liên quan. Frontend đóng gói message vào FormData và gửi đến /api/chat; backend phân loại trường hợp này là text_only rồi chuyển sang TextOnlyPipeline để xử lý.

Với chức năng gửi hình ảnh, người dùng tải lên ảnh địa điểm du lịch để hệ thống tìm ảnh tương tự trong collection ảnh của Qdrant. Backend dùng multer.memoryStorage() để nhận file vào bộ nhớ tạm thời, không lưu ảnh lâu dài trên ổ đĩa. Khi chỉ có ảnh và không có message, input_type là image_only và ImageOnlyPipeline sẽ xử lý.

Với chức năng gửi cả văn bản và hình ảnh, người dùng có thể hỏi trực tiếp về bức ảnh, ví dụ “ở đây có gì chơi?”, hoặc gửi ảnh một địa điểm nhưng hỏi thêm một địa điểm khác. Trong code backend, kiểu này là image_text. ImageTextPipeline vừa nhận diện địa điểm từ ảnh, vừa phân tích nội dung câu hỏi để xác định địa điểm cuối cùng cần truy xuất.

Hệ thống trả lời dựa trên dữ liệu truy xuất được, không để LLM trả lời tự do ngay từ đầu. Backend lấy dữ liệu từ Qdrant thông qua TextRepository, ImageRepository và LocationRepository. AnswerGenerator xây dựng prompt chứa retrieval JSON và yêu cầu Gemini trả lời bằng tiếng Việt, chỉ sử dụng dữ liệu đã truy xuất. Nếu dữ liệu chưa đủ, hệ thống trả thông báo chưa có đủ dữ liệu thay vì bịa thêm thông tin.

Ngoài câu trả lời chính, các pipeline còn tạo suggested_questions dựa trên locationName nếu có. Các câu gợi ý này giúp người dùng tiếp tục hỏi tự nhiên như hỏi địa điểm có gì chơi, địa điểm ở đâu hoặc xem thêm ảnh.


### 4.2 Yêu cầu phi chức năng

Bên cạnh các chức năng chính, hệ thống cần đáp ứng các yêu cầu phi chức năng để có thể phát triển và vận hành ổn định. Với ứng dụng có sử dụng LLM, embedding model, vector database và upload ảnh, các yêu cầu quan trọng gồm dễ mở rộng, dễ bảo trì, phản hồi rõ ràng, hạn chế trả lời sai và dễ cấu hình.

Yêu cầu dễ mở rộng được thể hiện qua cách backend tách thành nhiều lớp: controller, service, repository, pipeline, guard, llm, embeddings và config. Mỗi pipeline chịu trách nhiệm cho một kiểu input riêng. Khi cần bổ sung một luồng xử lý mới, hệ thống có thể thêm pipeline mới mà không cần sửa toàn bộ controller hoặc repository.

Yêu cầu dễ bảo trì được thể hiện qua mô hình Service + Repository. Repository tập trung tương tác với Qdrant, còn Service xử lý nghiệp vụ như context, S3 URL, fusion, resolver hoặc input router. Khi Qdrant thay đổi API hoặc tên vector, phần cần sửa chủ yếu nằm trong repository và config.

Yêu cầu phản hồi rõ ràng được hiện thực bằng response contract thống nhất trong responseFormatter.js. Mọi response đều có success, status, error_code, message, data và suggested_questions. Frontend vì vậy có thể render các trạng thái ok, error, out_of_scope, need_clarification và low_confidence theo cùng một cấu trúc.

Yêu cầu hạn chế trả lời sai hoặc bịa thông tin được đặt trong AnswerGenerator. Prompt yêu cầu Gemini chỉ sử dụng retrieval JSON được cung cấp, không bịa thêm sự kiện, giá, giờ mở cửa, địa chỉ hoặc mô tả nếu không có trong dữ liệu. Nếu intent không phải image_search mà docs rỗng, AnswerGenerator trả câu báo chưa có đủ dữ liệu thay vì gọi Gemini.

Hệ thống cũng cần có tính cấu hình tốt. Các thông số như APP_PORT, API_PREFIX, QDRANT_URL, QDRANT_API_KEY, tên collection Qdrant, GEMINI_API_KEYS, GEMINI_MODEL, TOP_K_DOCS, TOP_K_IMAGES, IMAGE_MATCH_THRESHOLD và IMAGE_LOW_CONFIDENCE_THRESHOLD được đọc từ env.js, giúp project chạy được ở local, server hoặc môi trường kiểm thử mà không cần sửa code nguồn.


### 4.3 Kiến trúc tổng thể hệ thống

Kiến trúc tổng thể của Travel AI Assistant gồm ba khối chính: frontend, backend và các dịch vụ bên ngoài. Frontend giao tiếp với người dùng, nhận câu hỏi hoặc ảnh, hiển thị câu trả lời, gallery ảnh, thông tin địa điểm và trạng thái lỗi. Backend xử lý nghiệp vụ, phân loại input, truy xuất dữ liệu, gọi embedding model, gọi LLM và chuẩn hóa response. Các dịch vụ bên ngoài gồm Qdrant external, Gemini API, Hugging Face model thông qua @huggingface/transformers và S3 để tạo URL ảnh.

Frontend đặt trong apps/web, xây dựng bằng ReactTS + Vite. Các component chính gồm ChatPage, ChatWindow, ChatInput, ImageUploadBox, BotMessage, UserMessage, ImageGallery, ImageCard, LocationInfoPanel, SuggestedQuestions và ErrorMessage. Khi người dùng gửi tin nhắn, chatApi.ts tạo FormData gồm session_id, message nếu có, và image nếu có, sau đó gửi POST /api/chat. axiosClient.ts cấu hình timeout 600000 ms để phù hợp với lần đầu tải embedding model hoặc xử lý request dài.

Backend đặt trong apps/api và dùng NodeJS + Express. server.js khởi động app với port từ appConfig.port. app.js cấu hình cors, express.json, multer.memoryStorage và khai báo các endpoint như GET /api/health, GET /api/health/qdrant, POST /api/chat và một số debug endpoint. Hiện tại route /api/chat được khai báo trực tiếp trong app.js, chưa có file router riêng.

Tầng controller có ChatController trong src/controllers/chat.controller.js. Controller không trực tiếp gọi Qdrant hoặc LLM mà nhận request, gọi InputRouterService để phân loại input_type, sau đó chuyển sang pipeline tương ứng. Thiết kế này giúp controller gọn và không bị phụ thuộc vào chi tiết xử lý của từng luồng.

Tầng pipeline là trung tâm điều phối nghiệp vụ. TextOnlyPipeline xử lý câu hỏi văn bản, ImageOnlyPipeline xử lý ảnh đơn, còn ImageTextPipeline xử lý trường hợp người dùng gửi cả ảnh và văn bản. Mỗi pipeline tự quyết định gọi guard, understanding service, embedding service, repository, S3 service, fusion service, answer generator và context service theo nhu cầu của luồng đó.

Tầng repository giao tiếp với Qdrant. TextRepository tìm kiếm tài liệu trong text_collection bằng text_vector. ImageRepository tìm kiếm ảnh trong image_collection bằng image_vector hoặc caption_vector, đồng thời hỗ trợ hybridSearchImagesByText. LocationRepository lấy metadata địa điểm trong location_info bằng filter location_id hoặc dò theo tên địa điểm.

Tầng LLM và embedding được tách riêng. GeminiClient gọi Google Generative Language API, hỗ trợ nhiều API key qua GEMINI_API_KEYS và tự thử key tiếp theo khi gặp lỗi quota hoặc rate-limit. Text Understanding Service và Image Text Understanding Service dùng Gemini để phân tích ý định và trả JSON theo schema. Answer Generator dùng Gemini để sinh câu trả lời tiếng Việt dựa trên dữ liệu retrieval. Về embedding, BgeM3EmbeddingService dùng onnx-community/bge-m3-ONNX cho text embedding, ImageEmbeddingService và SiglipTextEmbeddingService dùng Xenova/siglip-base-patch16-384 cho image embedding và text-to-image embedding.

Lớp kiến trúcThành phần chínhVai tròFrontendapps/web, ReactTS + Vite, ChatPage, ChatInput, ImageGalleryNhận input, gửi FormData, hiển thị ApiResponse.API/Controllerapp.js, ChatControllerKhai báo endpoint, nhận request, điều phối pipeline.Service/PipelineInputRouterService, ContextService, TextOnlyPipeline, ImageOnlyPipeline, ImageTextPipelineXử lý nghiệp vụ và điều phối retrieval/LLM.RepositoryTextRepository, ImageRepository, LocationRepositoryTruy xuất Qdrant external.AI ModelGeminiClient, BgeM3EmbeddingService, ImageEmbeddingService, SiglipTextEmbeddingServiceHiểu ngôn ngữ, tạo embedding, sinh câu trả lời.External storageQdrant, S3Lưu vector/document/image metadata và cung cấp URL ảnh.4.4 Thiết kế luồng xử lý request

Luồng xử lý request được thiết kế để frontend chỉ cần gọi một endpoint duy nhất là POST /api/chat. Endpoint này nhận multipart/form-data để hỗ trợ cả text và image trong cùng một request. Ba field chính là session_id, message và image. session_id dùng để duy trì context hội thoại, message là câu hỏi của người dùng, còn image là file ảnh được upload.

Trong app.js, multer được cấu hình bằng memoryStorage. Ảnh chỉ được giữ trong bộ nhớ trong thời gian xử lý request, sau đó truyền cho ImageEmbeddingService để tạo vector. Cách này giảm việc lưu file rác trên server và giữ backend đơn giản hơn.

Sau khi request vào ChatController, controller gọi inputRouterService.route(). Service này chuẩn hóa message bằng trim(), kiểm tra Boolean(image), rồi phân loại input_type bằng classify(). Nếu có message và không có image thì là text_only. Nếu có image và không có message thì là image_only. Nếu có cả hai thì là image_text. Nếu không có cả hai thì là empty_input.


### 1. Frontend gọi sendChatMessage() và tạo FormData.


### 2. Request đi vào POST /api/chat trong app.js.


### 3. multer đọc field image vào req.file nếu có.


### 4. ChatController.handle gọi InputRouterService.route().


### 5. InputRouterService trả session_id, input_type, message và image summary.


### 6. Nếu input_type là empty_input, controller trả errorResponse với EMPTY_INPUT.


### 7. Nếu input_type là text_only, controller gọi TextOnlyPipeline.run().


### 8. Nếu input_type là image_only, controller gọi ImageOnlyPipeline.run().


### 9. Nếu input_type là image_text, controller gọi ImageTextPipeline.run().

10. Pipeline trả về object gồm statusCode và body; controller dùng statusCode để trả HTTP response.

input_typeĐiều kiệnPipelinetext_onlyCó message sau khi trim(), không có imageTextOnlyPipeline trong src/pipelines/text-only.pipeline.jsimage_onlyCó image, không có messagemageOnlyPipeline trong src/pipelines/image-only.pipeline.jsimage_textCó cả message và imageImageTextPipeline trong src/pipelines/image-text.pipeline.jsempty_inputKhông có message và không có imageKhông gọi pipeline, trả error_code EMPTY_INPUT


### 4.5 Thiết kế response contract

Response contract giúp frontend hiển thị nhiều trạng thái khác nhau nhưng vẫn xử lý dữ liệu theo cùng một cấu trúc. Trong backend, responseFormatter.js định nghĩa createResponse, okResponse, errorResponse, outOfScopeResponse, needClarificationResponse và lowConfidenceResponse. Tất cả đều trả về cấu trúc ApiResponse thống nhất.

ApiResponse gồm success, status, error_code, message, data và suggested_questions. success thể hiện response thành công về mặt nghiệp vụ hay không. status thể hiện trạng thái nghiệp vụ cụ thể. error_code giúp frontend hoặc người kiểm thử nhận biết lỗi định danh. message là mô tả ngắn. data chứa payload chi tiết tùy pipeline. suggested_questions chứa danh sách câu hỏi gợi ý.

Việc tách status và error_code giúp biểu diễn các trạng thái không hẳn là lỗi kỹ thuật. low_confidence nghĩa là hệ thống tìm được ứng viên nhưng độ tin cậy chưa đủ cao. out_of_scope nghĩa là câu hỏi hoặc ảnh nằm ngoài phạm vi hỗ trợ. Các trạng thái này có thể trả HTTP 200 để frontend hiển thị thông báo thân thiện thay vì coi là lỗi mạng.

TrườngÝ nghĩasuccesstrue nếu request được xử lý thành công theo nghiệp vụ; false nếu lỗi hoặc trạng thái đặc biệt.statusMột trong các trạng thái ok, error, out_of_scope, need_clarification, low_confidence.error_codeMã lỗi định danh như EMPTY_INPUT, LLM_CLASSIFICATION_ERROR, LOW_CONFIDENCE_MATCH.messageThông báo ngắn để frontend hiển thị hoặc ghi log.dataDữ liệu chính của response, ví dụ answer, location, images, retrieval, debug.suggested_questionsDanh sách câu hỏi gợi ý tiếp theo.Khi status là ok, data của ba pipeline thường có answer, location, images, retrieval và debug. Đối với ảnh, ImageRepository chuẩn hóa payload thành các trường như image_id, title_name, s3_path, s3_bucket, s3_key, image_url, caption, location_id, location_name, score, rank và source. Nếu là hybrid search, ảnh có thể có thêm siglip_score, caption_score, final_score và sources. S3Service.attachImageUrls() tạo image_url từ s3_path để frontend không phải tự xử lý S3.


### 4.6. Thiết kế 3 luồng xử lý chính

Ba luồng xử lý chính là phần trung tâm của hệ thống. Mỗi luồng được tách thành một pipeline riêng để giảm độ phức tạp và giúp kiểm thử dễ hơn. Các pipeline đều nhận input đã được phân loại, xử lý guard hoặc validation, tạo embedding nếu cần, truy xuất Qdrant, tạo context truy xuất, gọi AnswerGenerator và cập nhật context hội thoại.


#### 4.6.1. Luồng text_only

Luồng text_only áp dụng khi người dùng chỉ nhập câu hỏi văn bản. Mục tiêu là hiểu ý định câu hỏi, xác định có cần tìm tài liệu, ảnh hoặc metadata không, sau đó truy xuất các collection phù hợp trong Qdrant. TextOnlyPipeline là class chính xử lý luồng này.

Luồng text_only được sử dụng khi người dùng chỉ nhập câu hỏi bằng văn bản mà không gửi kèm hình ảnh. Đây là luồng xử lý dành cho các trường hợp người dùng muốn hỏi thông tin về một địa điểm du lịch, hoạt động tham quan, hình ảnh liên quan hoặc các thông tin mô tả khác. Mục tiêu chính của luồng này là giúp hệ thống hiểu đúng nội dung câu hỏi, xác định loại dữ liệu cần truy xuất và tạo câu trả lời phù hợp dựa trên dữ liệu có trong hệ thống.

Khi người dùng gửi câu hỏi từ frontend, backend sẽ tiếp nhận request cùng với các thông tin cần thiết như mã phiên làm việc và nội dung câu hỏi. Sau đó, hệ thống xác định đây là trường hợp chỉ có văn bản đầu vào và chuyển request sang luồng xử lý text_only. Trong mã nguồn, quá trình điều phối này được thực hiện thông qua ChatController và TextOnlyPipeline.

Trước khi xử lý câu hỏi, hệ thống sẽ lấy lại ngữ cảnh hội thoại của phiên làm việc hiện tại. Ngữ cảnh này giúp hệ thống biết được trước đó người dùng đang hỏi về địa điểm nào, đã nhận được những hình ảnh nào hoặc có đang tiếp tục một câu hỏi cũ hay không. Nhờ vậy, nếu người dùng đặt những câu hỏi ngắn như “ở đó có gì chơi?” hoặc “cho xem thêm ảnh”, hệ thống vẫn có thể hiểu được câu hỏi đang liên quan đến nội dung trước đó. Thành phần đảm nhiệm việc quản lý ngữ cảnh là ContextService.

Sau khi có ngữ cảnh, hệ thống kiểm tra xem câu hỏi có thuộc phạm vi du lịch hay không. Những câu hỏi chắc chắn không liên quan đến du lịch sẽ được chặn lại và hệ thống trả về phản hồi ngoài phạm vi xử lý. Việc kiểm tra này giúp tránh trường hợp hệ thống trả lời những nội dung không phù hợp với mục tiêu của đề tài. Trong mã nguồn, bước này được thực hiện bởi TextDomainGuard.

Tiếp theo, hệ thống phân tích nội dung câu hỏi để hiểu rõ người dùng đang muốn gì. Câu hỏi được gửi đến Gemini để xác định lại nội dung tìm kiếm, kiểm tra có cần truy xuất tài liệu, hình ảnh hay metadata hay không, đồng thời xác định ý định của người dùng. Kết quả phân tích này được chuẩn hóa dưới dạng JSON, bao gồm các thông tin như rewrite_query, need_docs, need_images, need_metadata, location_id, location_name, is_follow_up và intent. Thành phần thực hiện bước này là TextUnderstandingService.

Trong trường hợp câu hỏi là câu hỏi tiếp nối, hệ thống sẽ dựa vào ngữ cảnh trước đó để bổ sung thông tin còn thiếu. Ví dụ, nếu người dùng hỏi “cho tôi xem thêm ảnh”, hệ thống có thể hiểu rằng người dùng đang muốn xem thêm ảnh của địa điểm đã được nhắc đến ở lượt hội thoại trước. Bước xử lý tham chiếu này được thực hiện bởi ReferenceResolver.

Sau khi đã hiểu nội dung câu hỏi, hệ thống lập kế hoạch truy xuất dữ liệu. Nếu câu hỏi cần thông tin văn bản, hệ thống sẽ tìm kiếm trong collection tài liệu. Nếu câu hỏi cần hình ảnh, hệ thống sẽ tìm kiếm trong collection ảnh. Nếu câu hỏi cần thông tin địa điểm, hệ thống sẽ truy xuất metadata tương ứng. Việc lập kế hoạch này được thực hiện bởi RetrievalPlanner.

Với trường hợp cần tìm tài liệu, hệ thống sử dụng BGE-M3 để chuyển câu hỏi đã được viết lại thành vector văn bản. Vector này sau đó được dùng để tìm kiếm các tài liệu liên quan trong Qdrant, cụ thể là trong text_collection với vector name text_vector. Nếu hệ thống đã xác định được location_id, quá trình tìm kiếm có thể được lọc theo địa điểm để kết quả chính xác hơn. Các thành phần liên quan gồm BgeM3EmbeddingService và TextRepository.

Với trường hợp cần tìm hình ảnh, hệ thống tạo thêm vector văn bản bằng SigLIP để phục vụ tìm kiếm ảnh theo nội dung câu hỏi. Đồng thời, hệ thống có thể kết hợp với vector BGE-M3 để tìm kiếm theo caption của ảnh. Kết quả từ các nhánh tìm kiếm được gộp lại nhằm chọn ra những hình ảnh phù hợp nhất với yêu cầu của người dùng. Trong mã nguồn, bước này được thực hiện thông qua SiglipTextEmbeddingService và ImageRepository.hybridSearchImagesByText() trên image_collection.

Nếu câu hỏi cần thông tin metadata và hệ thống đã xác định được địa điểm liên quan, metadata của địa điểm sẽ được truy xuất từ collection location_info. Thông tin này có thể bao gồm các dữ liệu mô tả giúp hệ thống hiểu rõ hơn về địa điểm và hỗ trợ tạo câu trả lời đầy đủ hơn. Thành phần thực hiện bước này là LocationRepository.

Sau khi hoàn tất các bước truy xuất, hệ thống gom toàn bộ dữ liệu thu được gồm câu hỏi đã xử lý, tài liệu, hình ảnh, metadata, kế hoạch truy xuất và thông tin debug thành một ngữ cảnh tổng hợp. Ngữ cảnh này được dùng làm dữ liệu đầu vào cho bước sinh câu trả lời. Trong mã nguồn, bước tổng hợp dữ liệu được thực hiện bởi FusionService.

Cuối cùng, AnswerGenerator sử dụng Gemini để sinh câu trả lời bằng tiếng Việt dựa trên dữ liệu đã truy xuất được. Cách xử lý này giúp hệ thống hạn chế việc trả lời tự do không có căn cứ, vì câu trả lời được tạo dựa trên retrieval JSON thay vì chỉ dựa vào kiến thức sẵn có của LLM. Sau khi có câu trả lời, hệ thống cập nhật lại context của phiên làm việc để phục vụ các câu hỏi tiếp theo, sau đó trả response về frontend dưới dạng okResponse.

Điểm đáng chú ý của text_only là hệ thống có thể phục vụ cả câu hỏi thông tin và câu hỏi tìm ảnh. Nếu intent là image_search, Text Understanding Service đặt need_images=true và Text Only Pipeline dùng hybrid search trên ảnh. Hybrid search kết hợp SigLIP text-to-image trên image_vector và BGE-M3 caption search trên caption_vector. Trong text_only, trọng số mặc định là siglip=0.3 và caption=0.7.


#### 4.6.2. Luồng image_only

Luồng image_only áp dụng khi người dùng chỉ gửi ảnh. Mục tiêu là nhận diện ảnh có tương ứng với một địa điểm du lịch trong dữ liệu hay không. Nếu độ tin cậy đủ cao, hệ thống lấy location_id từ ảnh match, truy xuất metadata và tài liệu liên quan để sinh câu trả lời tổng quan.

Luồng image_only được sử dụng khi người dùng chỉ gửi hình ảnh mà không nhập kèm câu hỏi văn bản. Mục tiêu của luồng này là xác định hình ảnh người dùng gửi lên có tương ứng với địa điểm du lịch nào trong hệ thống hay không, sau đó truy xuất thêm thông tin liên quan để tạo câu trả lời tổng quan cho người dùng.

Khi frontend gửi ảnh lên backend, ChatController sẽ tiếp nhận request và chuyển dữ liệu sang ImageOnlyPipeline để xử lý. Trước tiên, hệ thống kiểm tra tính hợp lệ của ảnh upload. Ảnh phải tồn tại dưới dạng buffer và có định dạng phù hợp, tức mimetype phải bắt đầu bằng image/. Nếu dữ liệu không hợp lệ, hệ thống sẽ trả về lỗi tương ứng.

Sau khi ảnh được xác nhận hợp lệ, hệ thống sử dụng ImageEmbeddingService để tạo vector đặc trưng cho ảnh. Vector này được tạo bằng mô hình SigLIP thông qua SiglipImageModelClient. Sau đó, hệ thống dùng vector ảnh để tìm kiếm các ảnh tương tự trong Qdrant, cụ thể là trong image_collection với vector name image_vector. Bước tìm kiếm này được thực hiện thông qua ImageRepository.searchImagesByImageVector().

Các ảnh tìm được sau đó được bổ sung đường dẫn hiển thị bằng S3Service. Service này đọc s3_path trong payload ảnh, xử lý thành đường dẫn image_url để frontend có thể hiển thị hình ảnh cho người dùng. Tiếp theo, hệ thống kiểm tra độ tin cậy của kết quả ảnh match bằng ConfidenceGuard. Nếu điểm tương đồng của ảnh thấp, pipeline sẽ trả về trạng thái low_confidence với mã lỗi LOW_CONFIDENCE_MATCH. Nếu ảnh match không có location_id, hệ thống cũng không thể xác định địa điểm và sẽ trả về lỗi IMAGE_LOCATION_NOT_FOUND.

Khi ảnh match đủ tin cậy và có location_id, hệ thống sử dụng location_id này để lấy metadata địa điểm từ collection location_info thông qua LocationRepository. Vì người dùng chỉ gửi ảnh và không nhập câu hỏi, hệ thống dùng một câu hỏi mặc định là: “Đây là địa điểm nào và thông tin tổng quan là gì?”. Câu hỏi mặc định này giúp pipeline có thể tiếp tục tìm kiếm tài liệu mô tả liên quan đến địa điểm đã nhận diện.

Tiếp theo, BgeM3EmbeddingService tạo vector văn bản cho câu hỏi mặc định. Vector này được dùng để tìm các tài liệu liên quan trong text_collection thông qua TextRepository, đồng thời lọc theo location_id để đảm bảo tài liệu thuộc đúng địa điểm đã match từ ảnh. Sau khi có ảnh, metadata và tài liệu liên quan, FusionService sẽ gom các dữ liệu này lại thành ngữ cảnh tổng hợp.

Cuối cùng, AnswerGenerator sử dụng Gemini để tạo câu trả lời tiếng Việt dựa trên dữ liệu đã truy xuất được. Sau khi sinh câu trả lời, hệ thống cập nhật lại context hội thoại để ghi nhớ địa điểm, ảnh đã trả về và nội dung xử lý gần nhất. Kết quả cuối cùng được trả về frontend, bao gồm câu trả lời, thông tin địa điểm, ảnh match, các ảnh liên quan, dữ liệu retrieval và các thông tin debug nếu có.

Thiết kế image_only tập trung vào độ tin cậy của ảnh. Hệ thống không trả lời ngay khi có một ảnh tương tự bất kỳ, mà phải đi qua ConfidenceGuard để hạn chế nhận diện nhầm ảnh không thuộc dữ liệu du lịch hoặc ảnh có điểm tương đồng thấp. Nếu image_url không tạo được do lỗi S3 hoặc thiếu cấu hình, pipeline vẫn có thể tiếp tục trả metadata với image_url=null.


#### 4.6.3. Luồng text_image / image_text

Luồng text_image trong báo cáo tương ứng với image_text trong code. Đây là luồng phức tạp nhất vì hệ thống phải kết hợp thông tin từ ảnh và văn bản. Người dùng có thể hỏi trực tiếp về ảnh, dùng ảnh làm ngữ cảnh cho câu hỏi hoặc gửi ảnh một địa điểm nhưng hỏi về địa điểm khác. Vì vậy ImageTextPipeline phải nhận diện địa điểm từ ảnh, hiểu ý định của text và giải quyết xung đột nếu có.

Luồng text_image, trong mã nguồn được phân loại là image_text, được sử dụng khi người dùng gửi đồng thời cả câu hỏi văn bản và hình ảnh. Mục tiêu của luồng này là vừa nhận diện địa điểm từ ảnh, vừa hiểu nội dung câu hỏi của người dùng, sau đó xác định dữ liệu cần truy xuất để tạo câu trả lời phù hợp.

Khi frontend gửi request gồm session_id, message và image lên backend, ChatController sẽ chuyển dữ liệu sang ImageTextPipeline để xử lý. Trước tiên, hệ thống kiểm tra tính hợp lệ của ảnh tương tự như luồng image_only. Sau đó, pipeline lấy lại context hội thoại hiện tại và khởi tạo thông tin debug cho quá trình truy xuất dữ liệu.

Ảnh người dùng gửi lên được chuyển thành vector bằng ImageEmbeddingService. Vector này được dùng để tìm kiếm ảnh tương tự trong image_collection thông qua ImageRepository.searchImagesByImageVector(). Sau khi có kết quả ảnh match, S3Service sẽ bổ sung image_url để frontend có thể hiển thị ảnh. Tiếp theo, ImageTextPipeline.evaluateImageConfidence() kiểm tra độ tin cậy của ảnh match. Nếu ảnh không phù hợp với phạm vi du lịch hoặc có độ tương đồng thấp, hệ thống sẽ trả về trạng thái out_of_scope hoặc low_confidence tương ứng.

Nếu ảnh đủ tin cậy, hệ thống lấy location_id và location_name từ ảnh match để tạo thông tin địa điểm trong ảnh, gọi là imagePlace. Thông tin này được đưa vào context hiện tại để tạo imageContext. Sau đó, TextDomainGuard kiểm tra nội dung văn bản người dùng nhập để đảm bảo câu hỏi vẫn nằm trong phạm vi du lịch.

Tiếp theo, ImageTextUnderstandingService sử dụng Gemini để phân tích câu hỏi trong mối liên hệ với địa điểm nhận diện từ ảnh. Kết quả phân tích được chuẩn hóa dưới dạng JSON, bao gồm thông tin địa điểm trong ảnh, địa điểm được nhắc đến trong văn bản, địa điểm cuối cùng cần trả lời, intent và các cờ cho biết có cần truy xuất tài liệu, hình ảnh hoặc metadata hay không.

Trong một số trường hợp, Gemini chỉ trả về tên địa điểm trong phần văn bản mà chưa có location_id. Khi đó, hệ thống có thể dùng enrichUnderstandingLocation() để gọi LocationRepository.findLocationByName(), nhằm tìm location_id tương ứng trong collection location_info. Sau đó, ImageTextResolver sẽ quyết định final_place_id và final_place_name. Nếu ảnh và câu hỏi văn bản đang nhắc đến hai địa điểm khác nhau, resolver sẽ ghi nhận conflict để hệ thống xử lý rõ ràng hơn khi sinh câu trả lời.

Sau khi xác định được địa điểm cuối cùng và ý định của người dùng, pipeline xây dựng kế hoạch truy xuất dữ liệu. Nếu cần tài liệu, hệ thống dùng BGE-M3 để tạo text embedding và tìm kiếm trong text_collection thông qua TextRepository. Nếu cần hình ảnh liên quan, hệ thống kết hợp BGE-M3 và SigLIP text embedding để thực hiện hybrid search trong image_collection bằng hybridSearchImagesByText(), với trọng số siglip=0.3 và caption=0.7. Nếu cần metadata, getLocationById() sẽ lấy thông tin địa điểm từ location_info.

Sau khi hoàn tất truy xuất, pipeline chọn danh sách ảnh phù hợp để trả về frontend. Nếu có tìm kiếm ảnh liên quan thì hệ thống dùng kết quả ảnh liên quan; nếu không, hệ thống trả về ảnh match ban đầu. Tiếp đó, AnswerGenerator sử dụng Gemini để sinh câu trả lời tiếng Việt dựa trên dữ liệu đã truy xuất và thông tin resolution, bao gồm image_place_id, text_place_id, final_place_id và conflict nếu có.

Cuối cùng, hệ thống cập nhật lại context hội thoại với các thông tin như last_image_place_id, last_text_place_id và last_conflict. Kết quả trả về frontend gồm câu trả lời, thông tin địa điểm, ảnh match, danh sách ảnh liên quan, dữ liệu retrieval và thông tin debug cần thiết.

Khi ảnh và văn bản đề cập hai địa điểm khác nhau, ImageTextResolver tạo conflict_type=image_text_place_mismatch. AnswerGenerator khi nhận conflict này sẽ có answer_hint yêu cầu nêu ngắn gọn rằng ảnh và text đang nói về hai địa điểm khác nhau, sau đó trả lời theo final_place_name. Thiết kế này giúp hệ thống xử lý tình huống nhập liệu không đồng nhất thay vì bỏ qua một trong hai nguồn thông tin.


### 4.7. Thiết kế context hội thoại

Context hội thoại giúp hệ thống hiểu các câu hỏi nối tiếp như “ở đó có gì chơi?” hoặc “cho tôi xem thêm ảnh”. Nếu không lưu context, hệ thống sẽ khó biết “ở đó” đang chỉ địa điểm nào. Trong project hiện tại, context được quản lý bởi ContextService trong src/services/context.service.js.

ContextService sử dụng Map trong bộ nhớ để lưu dữ liệu theo session_id. Nếu session_id không có, getSessionKey() dùng khóa anonymous. Mỗi session ban đầu được gán DEFAULT_CONTEXT. Cấu trúc này phù hợp với giai đoạn phát triển và demo vì đơn giản, không cần database riêng cho hội thoại. Tuy nhiên, do context nằm trong RAM, khi server restart thì context sẽ mất.

Trường contextÝ nghĩaold_inputCâu hỏi gốc gần nhất của người dùng.old_rewrite_queryCâu truy vấn đã được LLM hoặc resolver viết lại.active_location_id / active_location_nameĐịa điểm đang được xem là ngữ cảnh chính của phiên.last_returned_imagesDanh sách ảnh trả về gần nhất, dùng để xử lý tham chiếu theo ảnh.last_image_place_idĐịa điểm nhận diện từ ảnh gần nhất.last_text_place_idĐịa điểm nhận diện từ text gần nhất.last_conflictThông tin xung đột gần nhất giữa ảnh và text nếu có.pending_questionCâu hỏi đang chờ làm rõ nếu guard trả need_clarification.

Trong TextOnlyPipeline, context được dùng bởi TextDomainGuard để xác định câu hỏi có thể là follow-up hay không. TextUnderstandingService nhận compactContext gồm old_input, old_rewrite_query, active_location_id, active_location_name và last_returned_images để phân tích bằng Gemini. ReferenceResolver tiếp tục dùng context để bổ sung location_id hoặc location_name cho câu hỏi mơ hồ.

Trong ImageTextPipeline, context được mở rộng thành imageContext sau khi ảnh đã được match. imageContext đưa location_id và location_name của ảnh vào active_location_id và active_location_name, đồng thời lưu last_image_place_id và last_returned_images. Nhờ vậy, nếu message của người dùng là “ở đây có gì chơi?”, LLM và resolver có thể hiểu “ở đây” là địa điểm trong ảnh.

Sau khi pipeline xử lý thành công, updateOnSuccess() cập nhật context. Với text_only, hệ thống lưu old_input, old_rewrite_query, active_location_id, active_location_name, last_returned_images và last_text_place_id. Với image_only, old_input được đặt là “[image_only]” và old_rewrite_query là IMAGE_ONLY_DEFAULT_QUERY. Với image_text, hệ thống lưu cả last_image_place_id, last_text_place_id và last_conflict.


### 4.8. Thiết kế xử lý lỗi và các trạng thái phản hồi

Hệ thống không chỉ trả thành công hoặc thất bại đơn giản. Do đặc thù truy xuất vector và xử lý bằng AI, có nhiều tình huống cần biểu diễn rõ ràng: dữ liệu đầu vào thiếu, câu hỏi ngoài phạm vi, ảnh chưa đủ độ tin cậy, Qdrant lỗi, LLM trả JSON sai hoặc dữ liệu retrieval chưa đủ. Vì vậy backend dùng các trạng thái response thống nhất trong RESPONSE_STATUS.

Trạng thái ok được dùng khi pipeline xử lý thành công và có response hợp lệ cho frontend. Trong status ok, success=true và error_code=null. data thường chứa answer, retrieval, debug, location và images. Ngay cả khi một phần retrieval gặp lỗi nhưng pipeline vẫn đủ dữ liệu để trả lời, pipeline có thể ghi lỗi vào debug.retrieval_errors và vẫn trả ok.

Trạng thái error dùng cho lỗi kỹ thuật hoặc lỗi nghiệp vụ nghiêm trọng khiến pipeline không thể tiếp tục, ví dụ EMPTY_INPUT, LLM_CLASSIFICATION_ERROR, QDRANT_SEARCH_ERROR hoặc INTERNAL_ERROR. Trạng thái out_of_scope dùng khi text hoặc ảnh nằm ngoài phạm vi trợ lý du lịch. Trạng thái need_clarification được thiết kế cho trường hợp hệ thống cần người dùng làm rõ thêm; trong code hiện tại đã có contract và nhánh xử lý trong TextOnlyPipeline, nhưng chưa thấy được mở rộng nhiều trong TextDomainGuard. Trạng thái low_confidence dùng khi hệ thống có kết quả nhưng độ tin cậy chưa đủ, đặc biệt trong luồng nhận diện ảnh.

StatusHàm tạo responseTình huống sử dụngokokResponse()Pipeline xử lý thành công và có dữ liệu trả về.errorerrorResponse()Thiếu input, lỗi LLM, lỗi Qdrant, lỗi embedding hoặc lỗi nội bộ.out_of_scopeoutOfScopeResponse()Text hoặc ảnh nằm ngoài phạm vi du lịch được hỗ trợ.need_clarificationneedClarificationResponse()Hệ thống cần người dùng làm rõ thêm; đã có contract và nhánh xử lý trong TextOnlyPipeline.low_confidencelowConfidenceResponse()Ảnh hoặc kết quả match có độ tin cậy thấp, chưa đủ để trả lời chắc chắn.

Các mã lỗi được gom trong ERROR_CODES, bao gồm INTERNAL_ERROR, EMPTY_INPUT, EMBEDDING_MODEL_ERROR, LLM_CLASSIFICATION_ERROR, PIPELINE_NOT_IMPLEMENTED, QDRANT_CONNECTION_ERROR, QDRANT_COLLECTION_NOT_FOUND, QDRANT_SEARCH_ERROR, QDRANT_VECTOR_NAME_ERROR, IMAGE_NOT_TRAVEL_RELATED, IMAGE_LOCATION_NOT_FOUND, TEXT_NOT_TRAVEL_RELATED và LOW_CONFIDENCE_MATCH. Việc dùng mã lỗi rõ ràng giúp kiểm thử bằng Postman, debug log terminal và render giao diện frontend nhất quán hơn.

Đối với Qdrant, QdrantClient định nghĩa các lớp lỗi như QdrantConnectionError, QdrantCollectionNotFoundError, QdrantVectorNameError và QdrantSearchError. Endpoint GET /api/health/qdrant gọi QdrantHealthService để kiểm tra kết nối và ba collection bắt buộc: location_info, image_collection và text_collection. Thiết kế này giúp phát hiện sớm lỗi cấu hình Qdrant trước khi chạy các pipeline phức tạp.

Tổng kết chương

Chương 4 đã phân tích yêu cầu chức năng, yêu cầu phi chức năng và thiết kế tổng thể của Travel AI Assistant. Hệ thống được tổ chức theo hướng rõ lớp, dễ bảo trì: frontend gửi FormData, backend phân loại input bằng InputRouterService, controller điều phối pipeline, pipeline gọi service và repository để truy xuất dữ liệu, sau đó AnswerGenerator dùng Gemini tạo câu trả lời dựa trên dữ liệu retrieval. Ba luồng text_only, image_only và text_image/image_text được thiết kế riêng nhưng vẫn dùng chung response contract và context hội thoại. Cách thiết kế này phù hợp với mục tiêu xây dựng một trợ lý du lịch có khả năng xử lý cả văn bản lẫn hình ảnh, đồng thời hạn chế trả lời sai bằng cách bám vào dữ liệu truy xuất từ Qdrant.


## CHƯƠNG 5: XÂY DỰNG BACKEND

Chương này trình bày quá trình xây dựng backend cho hệ thống Travel AI Assistant. Nội dung được viết dựa trên project hiện tại trong thư mục apps/api, sử dụng NodeJS và Express thuần JavaScript. Backend không chỉ đóng vai trò nhận request từ frontend mà còn là lớp điều phối toàn bộ quá trình xử lý AI: phân loại input, gọi pipeline, tạo embedding, truy xuất Qdrant, tạo URL ảnh từ S3, gọi Gemini LLM và chuẩn hóa response trả về frontend.

Các nội dung trong chương được trình bày theo hướng báo cáo đồ án tốt nghiệp, tập trung giải thích cách xây dựng từng thành phần, lý do tách lớp, vai trò của các service/repository/pipeline và cách các module phối hợp trong endpoint chính POST /api/chat.


### 5.1. Vai trò của backend trong hệ thống

Trong Travel AI Assistant, backend là thành phần trung tâm của toàn bộ hệ thống. Frontend chỉ đảm nhiệm việc hiển thị giao diện chat, cho phép người dùng nhập câu hỏi, chọn ảnh và hiển thị kết quả trả về. Các thao tác phức tạp như hiểu câu hỏi, tạo vector embedding, tìm kiếm dữ liệu trong Qdrant, gọi Gemini để sinh câu trả lời và tạo URL ảnh đều được thực hiện ở backend.

Backend giữ vai trò trung gian giữa người dùng và các dịch vụ AI bên ngoài. Khi frontend gửi request đến POST /api/chat, backend không chuyển trực tiếp nội dung cho LLM. Thay vào đó, hệ thống phân loại input thành text_only, image_only hoặc image_text, sau đó chọn pipeline phù hợp. Mỗi pipeline sẽ quyết định cần tìm tài liệu, ảnh hay metadata địa điểm, rồi mới gọi Gemini để tạo câu trả lời cuối cùng. Cách xử lý này giúp câu trả lời có căn cứ từ dữ liệu truy xuất, hạn chế tình trạng LLM tự bịa thông tin.

Backend cũng chịu trách nhiệm che giấu chi tiết kỹ thuật khỏi frontend. Frontend không cần biết Qdrant có những collection nào, vector tên gì, ảnh nằm trên bucket S3 nào, hoặc model embedding được chạy như thế nào. Frontend chỉ cần gửi FormData và nhận ApiResponse thống nhất. Điều này làm giảm độ phức tạp phía giao diện và giúp backend có thể thay đổi logic bên trong mà ít ảnh hưởng đến frontend.

Một vai trò quan trọng khác của backend là chuẩn hóa luồng xử lý lỗi. Các lỗi như thiếu input, lỗi Qdrant, lỗi Gemini, ảnh có độ tin cậy thấp hoặc câu hỏi ngoài phạm vi đều được đưa về response contract chung. Nhờ vậy, frontend có thể hiển thị các trạng thái khác nhau một cách nhất quán.

Vai tròMô tả trong projectNhận requestExpress app trong app.js nhận POST /api/chat và các endpoint health/debug.Điều phối nghiệp vụChatController gọi InputRouterService và chuyển request đến pipeline phù hợp.Tích hợp AIBackend gọi BGE-M3, SigLIP và Gemini thông qua các service riêng.Truy xuất dữ liệuRepository truy xuất Qdrant external qua QdrantClient.Chuẩn hóa responseresponseFormatter.js tạo ApiResponse thống nhất cho frontend.


### 5.2. Xây dựng server bằng NodeJS và Express

Backend được xây dựng bằng NodeJS và Express theo hướng JavaScript thuần, không dùng TypeScript. Thông tin này thể hiện trong package.json của apps/api, trong đó main trỏ đến src/server.js. Các script chính gồm npm run dev để chạy bằng nodemon, npm start để chạy bằng Node trực tiếp và npm test để chạy test bằng node --test.

File src/server.js là điểm khởi động server. File này import app từ src/app.js và appConfig từ src/config/env.js. Server lắng nghe trên appConfig.port và host mặc định là 0.0.0.0. Khi server chạy, terminal in ra địa chỉ API theo dạng http://host:port/apiPrefix. Trong project hiện tại, APP_PORT mặc định đã được cấu hình là 8000 và API_PREFIX mặc định là /api.

File src/app.js chịu trách nhiệm tạo Express application. Hàm createApp() cấu hình cors để frontend có thể gọi API, express.json() để đọc JSON body cho các endpoint debug, và multer.memoryStorage() để nhận file ảnh từ multipart/form-data. Việc dùng memoryStorage phù hợp với yêu cầu xử lý ảnh tạm thời, vì ảnh upload chỉ cần dùng để tạo embedding, không cần lưu lâu dài trên server.

Trong app.js, các route được khai báo trực tiếp, gồm GET /api/health, GET /api/health/qdrant, POST /api/chat và một số endpoint debug. Hiện tại project không tách riêng file routes/chat.routes.js; route chat được gắn trực tiếp bằng app.post(`${appConfig.apiPrefix}/chat`,upload.single("image"),chatController.handle.

Thành phầnFileVai tròServer bootstrapsrc/server.jsKhởi động Express app, lắng nghe port, xử lý SIGINT/SIGTERM.Express appsrc/app.jsCấu hình middleware, multer và khai báo endpoint.Configsrc/config/env.jsĐọc biến môi trường cho port, prefix, Qdrant, Gemini, S3, embedding.Dev runnerpackage.jsonDùng nodemon để chạy npm run dev.


### 5.3. Xây dựng endpoint chính POST /api/chat

Endpoint quan trọng nhất của backend là POST /api/chat. Đây là endpoint duy nhất phục vụ chức năng chat AI của người dùng. Endpoint này nhận multipart/form-data vì dữ liệu đầu vào có thể chỉ là văn bản, chỉ là ảnh, hoặc đồng thời có cả văn bản và ảnh.

Trong app.js, middleware upload.single("image") của multer được đặt trước chatController.handle. Điều này giúp file ảnh nếu có sẽ được đưa vào req.file, còn các field text như session_id và message nằm trong req.body. Controller sau đó có thể xử lý thống nhất cả ba tình huống input.

ChatController trong src/controllers/chat.controller.js là lớp xử lý request chính. Controller không trực tiếp gọi Qdrant hay Gemini. Nhiệm vụ của nó là nhận request, gọi inputRouterService.route() để phân loại input, xử lý trường hợp empty_input, sau đó gọi pipeline tương ứng. Khi pipeline trả về statusCode và body, controller dùng res.status(pipelineResult.statusCode).json(pipelineResult.body) để trả response.

Cách thiết kế này giúp endpoint /api/chat có cấu trúc rõ ràng. Controller đóng vai trò điều phối cấp cao, còn nghiệp vụ chi tiết được đặt trong pipeline. Nếu sau này cần thay đổi logic text_only hoặc image_only, có thể chỉnh trong pipeline tương ứng mà không cần làm controller phức tạp.


### 1. Frontend gửi FormData đến POST /api/chat.


### 2. Multer đọc field image vào req.file nếu có.


### 3. ChatController gọi InputRouterService để xác định input_type.


### 4. Nếu input_type là empty_input, backend trả EMPTY_INPUT.


### 5. Nếu input_type là text_only, backend gọi TextOnlyPipeline.


### 6. Nếu input_type là image_only, backend gọi ImageOnlyPipeline.


### 7. Nếu input_type là image_text, backend gọi ImageTextPipeline.


### 8. Pipeline xử lý xong trả statusCode và body về controller.


### 5.4. Xử lý dữ liệu đầu vào từ frontend

Dữ liệu đầu vào của endpoint /api/chat gồm ba phần chính: session_id, message và image. Các dữ liệu này được frontend gửi bằng FormData trong apps/web/src/api/chatApi.ts. Backend nhận dữ liệu tương ứng qua req.body.session_id, req.body.message và req.file.

session_id dùng để định danh phiên hội thoại. Khi người dùng hỏi nhiều câu liên tiếp, backend có thể dựa vào session_id để lấy context cũ trong ContextService. Nếu session_id không được gửi, ContextService dùng khóa mặc định anonymous. Trong response, session_id cũng được đưa lại vào data để frontend hoặc công cụ kiểm thử biết request thuộc phiên nào.



瑹ෞLЀ⭈⭊⭢⭸⯜{爀r爀	ᘀĤ晉摧ෞL欀兤ˣᘀĤ␗䤁ŦȀખԀᣖĄĄĄĄĄĄ혈Fᘀ砈稏#ᘆ戆Ȇጀブ＀Ą＀Ą＀Ą＀Ą＀Ą＀ĄᔀĶ혚ÿÿ᯿ೖ＀＀＀혜ÿÿ᷿ೖ＀＀＀혴ਁਃ愀϶

瑹ෞLЀ⯜⯞⯬ⰐⲚ{爀r爀	ᘀĤ晉摧ෞL欀ˣᘀĤ␗䤁ŦȀખԀᣖĄĄĄĄĄĄ혈Fᘀ砈稏#ᘆ戆Ȇጀブ＀Ą＀Ą＀Ą＀Ą＀Ą＀ĄᔀĶ혚ÿÿ᯿ೖ＀＀＀혜ÿÿ᷿ೖ＀＀＀혴ਁਃ愀϶

瑹ෞLЀⲚⲜⲲⳌⴐ{爀r爀	ᘀĤ晉摧ෞL欀齤ˤᘀĤ␗䤁ŦȀખԀᣖĄĄĄĄĄĄ혈Fᘀ砈稏#ᘆ戆Ȇጀブ＀Ą＀Ą＀Ą＀Ą＀Ą＀ĄᔀĶ혚ÿÿ᯿ೖ＀＀＀혜ÿÿ᷿ೖ＀＀＀혴ਁਃ愀϶

瑹ෞLЀⴐⴒⴔ⵬⽤㆜㓜㜜㝶㟔㡖㣌㥈{瘀q氀l氀l氀l氀l氀Ѐ摧䴼lЀ摧ෞLЀ摧ෞL欀䙤˥ᘀĤ␗䤁ŦȀખԀᣖĄĄĄĄĄĄ혈Fᘀ砈稏#ᘆ戆Ȇጀブ＀Ą＀Ą＀Ą＀Ą＀Ą＀ĄᔀĶ혚ÿÿ᯿ೖ＀＀＀혜ÿÿ᷿ೖ＀＀＀혴ਁਃ愀϶


image là file ảnh người dùng upload. app.js dùng upload.single("image") nên backend chỉ nhận một ảnh cho mỗi request. File ảnh được lưu trong bộ nhớ thông qua multer.memoryStorage(). Các pipeline image_only và image_text đều gọi validateUploadedImage() để kiểm tra ảnh có buffer và mimetype bắt đầu bằng image/. Nếu không hợp lệ, backend trả lỗi EMPTY_INPUT hoặc UNSUPPORTED_FILE_TYPE.

InputNơi nhận trong backendCách sử dụngsession_idreq.body.session_idDùng để lấy và cập nhật context hội thoại.messagereq.body.messageĐược trim, phân loại input, gửi cho LLM understanding và AnswerGenerator.imagereq.fileĐược validate, tạo SigLIP image embedding và tìm ảnh tương tự trong Qdrant.5.5. Phân loại input đầu vào

Phân loại input được thực hiện bởi InputRouterService trong src/services/inputRouter.service.js. Service này tách riêng khỏi controller để đảm bảo logic xác định kiểu đầu vào được dùng thống nhất và dễ kiểm thử.

InputRouterService kiểm tra hai biến hasMessage và hasImage. hasMessage bằng true khi message sau khi trim có độ dài lớn hơn 0. hasImage bằng true khi req.file tồn tại. Dựa trên hai giá trị này, hàm classify() trả về một trong bốn loại: text_only, image_only, image_text hoặc empty_input.

Ngoài input_type, InputRouterService còn trả image summary nếu có ảnh, gồm field_name, original_name, mime_type và size. Đây là thông tin nhẹ dùng để debug hoặc trả về trong một số response lỗi, không chứa buffer ảnh.

input_typeĐiều kiệnÝ nghĩa xử lýtext_onlyCó message, không có imageNgười dùng chỉ hỏi bằng văn bản; gọi TextOnlyPipeline.image_onlyCó image, không có messageNgười dùng chỉ gửi ảnh; gọi ImageOnlyPipeline.image_textCó cả message và imageNgười dùng gửi cả ảnh và câu hỏi; gọi ImageTextPipeline.empty_inputKhông có cả message lẫn imageBackend trả error_code EMPTY_INPUT, không gọi pipeline.5.6. Xây dựng các pipeline xử lý chính

Pipeline là lớp điều phối nghiệp vụ sâu nhất trong backend. Mỗi pipeline chịu trách nhiệm xử lý một kiểu input. Việc tách pipeline giúp mỗi luồng có thể phát triển độc lập, đồng thời giữ controller đơn giản. Ba pipeline chính của hệ thống gồm TextOnlyPipeline, ImageOnlyPipeline và ImageTextPipeline.

TextOnlyPipeline

TextOnlyPipeline là pipeline xử lý trường hợp người dùng chỉ nhập câu hỏi bằng văn bản. Luồng này bắt đầu bằng việc lấy lại context hội thoại, sau đó kiểm tra câu hỏi có thuộc phạm vi du lịch hay không. Nếu hợp lệ, hệ thống dùng Gemini để phân tích ý định câu hỏi, xác định người dùng cần tìm tài liệu, hình ảnh hay thông tin địa điểm.

Sau khi hiểu câu hỏi, hệ thống tiếp tục xử lý các câu hỏi dạng follow-up dựa trên ngữ cảnh trước đó, rồi lập kế hoạch truy xuất dữ liệu. Nếu cần tài liệu, pipeline dùng BGE-M3 để tạo text embedding và tìm kiếm trong text_collection. Nếu cần hình ảnh, hệ thống kết hợp BGE-M3 và SigLIP để thực hiện hybrid search trong image_collection. Nếu cần metadata, hệ thống lấy thông tin địa điểm từ location_info.

Cuối cùng, các dữ liệu truy xuất được sẽ được đưa vào AnswerGenerator để Gemini tạo câu trả lời tiếng Việt. Sau khi trả lời xong, hệ thống cập nhật lại context để phục vụ các câu hỏi tiếp theo của người dùng.

ImageOnlyPipeline

ImageOnlyPipeline là pipeline xử lý trường hợp người dùng chỉ gửi hình ảnh mà không nhập kèm văn bản. Vì đầu vào không có câu hỏi, hệ thống không cần dùng LLM để phân tích ý định ban đầu. Thay vào đó, pipeline tập trung vào việc kiểm tra ảnh, nhận diện địa điểm từ ảnh và truy xuất thêm dữ liệu liên quan để tạo câu trả lời tổng quan.

Sau khi ảnh được gửi lên, hệ thống kiểm tra định dạng ảnh có hợp lệ hay không. Nếu hợp lệ, ImageEmbeddingService sẽ sử dụng SigLIP để chuyển ảnh thành vector. Vector này được dùng để tìm các ảnh tương tự trong image_collection thông qua ImageRepository. Các ảnh tìm được sẽ được S3Service bổ sung image_url để frontend có thể hiển thị.

Tiếp theo, ConfidenceGuard kiểm tra độ tin cậy của ảnh match. Nếu điểm tương đồng thấp, hệ thống trả về trạng thái low_confidence. Nếu ảnh đủ tin cậy, pipeline lấy location_id từ ảnh match để truy xuất metadata địa điểm trong location_info. Vì người dùng không nhập câu hỏi, hệ thống sử dụng câu hỏi mặc định “Đây là địa điểm nào và thông tin tổng quan là gì?” để tìm tài liệu liên quan trong text_collection.

Cuối cùng, dữ liệu gồm ảnh match, metadata và tài liệu liên quan được đưa vào AnswerGenerator để Gemini sinh câu trả lời tổng quan bằng tiếng Việt. Sau đó, pipeline cập nhật context hội thoại và trả kết quả về frontend.

ImageTextPipeline

ImageTextPipeline là pipeline xử lý trường hợp người dùng gửi đồng thời cả hình ảnh và văn bản. Đây là luồng phức tạp hơn vì hệ thống cần kết hợp thông tin nhận diện từ ảnh với ý định trong câu hỏi của người dùng.

Trước tiên, pipeline kiểm tra ảnh và sử dụng SigLIP để tạo image embedding, sau đó tìm ảnh tương tự trong image_collection. Nếu ảnh match đủ tin cậy, hệ thống lấy location_id và location_name để xác định địa điểm trong ảnh. Tiếp theo, nội dung văn bản được kiểm tra phạm vi du lịch và được Gemini phân tích thông qua ImageTextUnderstandingService.

Sau khi hiểu được câu hỏi, ImageTextResolver sẽ xác định địa điểm cuối cùng cần truy xuất. Nếu ảnh và văn bản đang nhắc đến hai địa điểm khác nhau, hệ thống sẽ ghi nhận conflict để xử lý rõ ràng khi trả lời. Cuối cùng, pipeline truy xuất tài liệu, hình ảnh liên quan và metadata nếu cần, sau đó đưa dữ liệu vào AnswerGenerator để tạo câu trả lời tiếng Việt và cập nhật context hội thoại.

PipelineInputThành phần nổi bậtOutput chínhTextOnlyPipelinemessageTextUnderstandingService, BGE-M3, hybrid image search nếu intent=image_searchanswer, location, images, retrieval, debugImageOnlyPipelineimageSigLIP image embedding, ConfidenceGuard, default queryanswer, matched_image, location, imagesImageTextPipelinemessage + imageSigLIP image match, ImageTextUnderstandingService, ImageTextResolver, conflict handlinganswer, matched_image, images, conflict/debug5.7. Xây dựng các service xử lý nghiệp vụ

Các service trong backend được dùng để tách các nghiệp vụ có thể tái sử dụng khỏi pipeline. Pipeline chỉ đóng vai trò điều phối, còn các thao tác cụ thể như phân loại input, hiểu câu hỏi, quản lý context, gom dữ liệu retrieval hoặc sinh câu trả lời được đặt trong service riêng.

Trước hết, InputRouterService có nhiệm vụ xác định kiểu dữ liệu mà người dùng gửi lên hệ thống. Sau khi controller nhận request từ frontend, service này sẽ kiểm tra trong request có văn bản hay không, có hình ảnh hay không, từ đó phân loại thành các luồng như text_only, image_only, image_text hoặc empty_input. Việc phân loại này rất quan trọng vì mỗi kiểu đầu vào sẽ được xử lý bởi một pipeline khác nhau.

Đối với trường hợp người dùng chỉ gửi câu hỏi bằng văn bản, TextUnderstandingService được sử dụng để phân tích nội dung câu hỏi. Service này dùng Gemini để hiểu người dùng đang muốn hỏi gì, có cần tìm tài liệu, tìm hình ảnh hay lấy thông tin địa điểm hay không. Kết quả phân tích được chuẩn hóa thành một cấu trúc JSON gồm các thông tin như câu hỏi đã được viết lại, nhu cầu truy xuất dữ liệu, địa điểm liên quan, câu hỏi có phải dạng tiếp nối hay không và ý định của người dùng. Nếu kết quả Gemini trả về không đúng cấu trúc yêu cầu, hệ thống sẽ xem đây là lỗi phân loại của LLM.

Với trường hợp người dùng gửi đồng thời cả hình ảnh và văn bản, ImageTextUnderstandingService được sử dụng để phân tích mối quan hệ giữa ảnh và câu hỏi. Service này không chỉ hiểu nội dung câu hỏi, mà còn cần xác định địa điểm trong ảnh, địa điểm được nhắc đến trong văn bản và địa điểm cuối cùng mà hệ thống cần trả lời. Nhờ vậy, pipeline có thể xử lý được những tình huống như người dùng hỏi về chính địa điểm trong ảnh, hỏi một địa điểm khác, hoặc ảnh và văn bản đang nhắc đến hai địa điểm không trùng nhau.

ContextService có nhiệm vụ quản lý ngữ cảnh hội thoại của từng phiên làm việc. Trong quá trình trò chuyện, người dùng có thể đặt các câu hỏi tiếp nối như “ở đó có gì chơi?”, “cho xem thêm ảnh” hoặc “địa điểm này ở đâu?”. Để hiểu được các câu hỏi như vậy, hệ thống cần lưu lại thông tin của các lượt hỏi trước, chẳng hạn như câu hỏi cũ, câu hỏi đã được viết lại, địa điểm đang được quan tâm, danh sách ảnh đã trả về hoặc các xung đột giữa ảnh và văn bản. Sau khi một pipeline xử lý thành công, context sẽ được cập nhật để phục vụ cho các câu hỏi tiếp theo.

FusionService đảm nhiệm vai trò tổng hợp dữ liệu sau khi hệ thống đã truy xuất xong thông tin từ các nguồn khác nhau. Các dữ liệu như câu hỏi, câu hỏi đã viết lại, tài liệu tìm được, hình ảnh liên quan, metadata địa điểm, kế hoạch truy xuất và thông tin debug sẽ được gom lại thành một đối tượng thống nhất. Trong hệ thống hiện tại, FusionService chủ yếu đóng vai trò chuẩn bị dữ liệu đầu vào cho bước sinh câu trả lời, chưa thực hiện các thuật toán kết hợp dữ liệu phức tạp.

Cuối cùng, AnswerGenerator là thành phần tạo ra câu trả lời cuối cùng cho người dùng. Service này nhận dữ liệu đã được truy xuất và tổng hợp, sau đó đưa vào prompt để Gemini sinh câu trả lời bằng tiếng Việt. Nội dung prompt yêu cầu mô hình chỉ trả lời dựa trên dữ liệu có trong retrieval JSON, hạn chế bịa thêm thông tin không có trong hệ thống. Nếu hệ thống không tìm được tài liệu phù hợp và câu hỏi không phải yêu cầu tìm kiếm hình ảnh, AnswerGenerator sẽ trả về thông báo rằng dữ liệu hiện tại chưa đủ để trả lời, thay vì để Gemini tự suy diễn.

ServiceFileVai tròInputRouterServicesrc/services/inputRouter.service.jsPhân loại input đầu vào.TextUnderstandingServicesrc/llm/textUnderstanding.jsDùng Gemini hiểu câu hỏi text_only.ImageTextUnderstandingServicesrc/llm/imageTextUnderstanding.jsDùng Gemini hiểu request có cả ảnh và text.ContextServicesrc/services/context.service.jsLưu và cập nhật context hội thoại theo session_id.FusionServicesrc/services/fusion.service.jsGom dữ liệu retrieval thành context thống nhất.AnswerGeneratorsrc/llm/answerGenerator.jsSinh câu trả lời tiếng Việt dựa trên retrieval JSON.


### 5.8. Xây dựng repository truy xuất dữ liệu

Repository là lớp chịu trách nhiệm truy xuất dữ liệu từ Qdrant. Backend tách repository khỏi pipeline để pipeline không cần biết chi tiết endpoint HTTP của Qdrant, tên API search/scroll hoặc cách normalize payload. Ba repository chính gồm TextRepository, ImageRepository và LocationRepository.

TextRepository được sử dụng để tìm kiếm các tài liệu văn bản liên quan đến câu hỏi của người dùng. Khi hệ thống đã tạo được vector từ câu hỏi bằng mô hình embedding, vector này sẽ được gửi đến TextRepository để tìm trong collection lưu tài liệu văn bản. Nếu hệ thống đã xác định được địa điểm liên quan, quá trình tìm kiếm sẽ được lọc theo location_id để ưu tiên các tài liệu thuộc đúng địa điểm đó. Trong mã nguồn, TextRepository làm việc với text_collection và sử dụng vector name text_vector.

ImageRepository đảm nhiệm việc tìm kiếm hình ảnh trong hệ thống. Repository này có thể xử lý nhiều kiểu tìm kiếm khác nhau. Khi người dùng upload ảnh, hệ thống tạo image vector từ ảnh đó và dùng ImageRepository để tìm các ảnh tương tự trong image_collection. Khi người dùng hỏi bằng văn bản nhưng muốn tìm ảnh, hệ thống có thể dùng SigLIP text vector để tìm ảnh theo nội dung câu hỏi, hoặc dùng BGE-M3 text vector để tìm theo caption của ảnh. Đối với trường hợp hybrid search, ImageRepository kết hợp hai hướng tìm kiếm này, sau đó gộp kết quả, tính điểm cuối cùng và sắp xếp ảnh theo mức độ phù hợp. Trong mã nguồn, các vector chính được sử dụng là image_vector và caption_vector.

LocationRepository được sử dụng để truy xuất thông tin metadata của địa điểm. Khi hệ thống đã biết location_id, repository này sẽ lấy thông tin tương ứng từ collection location_info. Metadata này giúp pipeline bổ sung thông tin địa điểm vào quá trình trả lời, chẳng hạn như tên địa điểm hoặc các dữ liệu mô tả liên quan. Ngoài ra, trong một số trường hợp hệ thống chỉ có tên địa điểm mà chưa có location_id, LocationRepository có thể dò tìm địa điểm dựa trên tên đã được chuẩn hóa. Chức năng này đặc biệt hữu ích trong luồng image_text, khi mô hình LLM nhận diện được tên địa điểm trong câu hỏi nhưng chưa xác định được mã địa điểm cụ thể.

Nhìn chung, ba repository này tạo thành lớp truy xuất dữ liệu chính của backend. TextRepository phục vụ tìm kiếm tài liệu, ImageRepository phục vụ tìm kiếm hình ảnh, còn LocationRepository phục vụ lấy thông tin địa điểm. Nhờ tách riêng các repository, các pipeline xử lý như text_only, image_only và image_text có thể truy xuất dữ liệu từ Qdrant một cách rõ ràng, thống nhất và dễ mở rộng hơn.

ServiceFileVai tròInputRouterServicesrc/services/inputRouter.service.jsPhân loại input đầu vào.TextUnderstandingServicesrc/llm/textUnderstanding.jsDùng Gemini hiểu câu hỏi text_only.ImageTextUnderstandingServicesrc/llm/imageTextUnderstanding.jsDùng Gemini hiểu request có cả ảnh và text.ContextServicesrc/services/context.service.jsLưu và cập nhật context hội thoại theo session_id.FusionServicesrc/services/fusion.service.jsGom dữ liệu retrieval thành context thống nhất.AnswerGeneratorsrc/llm/answerGenerator.jsSinh câu trả lời tiếng Việt dựa trên retrieval JSON.


### 5.9. Tích hợp Qdrant vào backend

Qdrant được tích hợp như một external vector database. Backend không tạo collection, không insert dữ liệu và không chạy Docker Qdrant. Thay vào đó, backend kết nối đến Qdrant external bằng QDRANT_URL và QDRANT_API_KEY đọc từ env.js. Điều này phù hợp với định hướng dữ liệu vector đã được chuẩn bị sẵn bên ngoài.

QdrantClient là thành phần dùng để giao tiếp với Qdrant từ phía backend. Thay vì để từng repository gọi trực tiếp vào Qdrant, hệ thống sử dụng QdrantClient để thống nhất các thao tác như kiểm tra danh sách collection, tìm kiếm vector và đọc dữ liệu theo filter. Nhờ đó, các repository như TextRepository, ImageRepository và LocationRepository có thể truy xuất dữ liệu một cách rõ ràng và dễ quản lý hơn.

Bên cạnh việc gửi request đến Qdrant, QdrantClient còn xử lý lỗi tập trung. Các lỗi như không kết nối được Qdrant, không tìm thấy collection, sai vector name hoặc lỗi tìm kiếm đều được phân loại rõ ràng. Điều này giúp quá trình debug thuận tiện hơn, đặc biệt khi cấu hình collection hoặc vector name trong backend không khớp với dữ liệu đang có trong Qdrant.

Ngoài ra, backend còn có endpoint kiểm tra trạng thái Qdrant là GET /api/health/qdrant. Endpoint này dùng để kiểm tra kết nối đến Qdrant và xác nhận các collection cần thiết như location_info, image_collection và text_collection đã tồn tại. Đây là bước quan trọng trước khi chạy luồng chat, vì các pipeline xử lý đều cần truy xuất dữ liệu từ Qdrant.

Collection QdrantCấu hình trong env.jsĐược dùng bởilocation_infoappConfig.qdrant.collections.locationLocationRepositoryimage_collectionappConfig.qdrant.collections.imageImageRepositorytext_collectionappConfig.qdrant.collections.textTextRepository5.10. Tích hợp embedding model

Embedding model là thành phần giúp hệ thống chuyển văn bản và hình ảnh thành các vector số để phục vụ tìm kiếm trong Qdrant. Trong project hiện tại, hệ thống đã sử dụng model embedding thật thông qua thư viện @huggingface/transformers thay vì dùng dữ liệu giả lập. Các thông tin như tên model, số chiều vector, cache model và cấu hình chuẩn hóa vector được quản lý trong file cấu hình của backend.

Đối với dữ liệu văn bản, hệ thống sử dụng BGE-M3 để tạo text embedding. Model này được dùng để chuyển câu hỏi đã xử lý của người dùng, chẳng hạn như rewrite_query hoặc default_query, thành vector. Vector sau đó được dùng để tìm kiếm các tài liệu liên quan trong text_collection của Qdrant. Ngoài ra, BGE-M3 còn được sử dụng trong nhánh tìm kiếm ảnh theo caption, giúp hệ thống tìm được hình ảnh có nội dung mô tả phù hợp với câu hỏi.

Đối với dữ liệu hình ảnh, hệ thống sử dụng SigLIP để tạo image embedding từ ảnh người dùng upload. Vector ảnh này được dùng để tìm các ảnh tương tự trong image_collection. Bên cạnh đó, SigLIP cũng được dùng để tạo text-to-image embedding, tức là chuyển câu hỏi văn bản thành vector tương thích với vector ảnh, phục vụ cho chức năng tìm kiếm ảnh bằng văn bản.

Trong quá trình tạo embedding, hệ thống cũng kiểm tra tính hợp lệ của vector sau khi sinh ra, bao gồm việc kiểm tra vector có đúng kiểu dữ liệu và đúng số chiều hay không. Nếu model không tải được hoặc vector tạo ra không đúng cấu hình, backend sẽ trả lỗi embedding tương ứng. Nhờ có các embedding model này, hệ thống có thể thực hiện tìm kiếm ngữ nghĩa trên cả văn bản và hình ảnh, thay vì chỉ tìm kiếm theo từ khóa thông thường.

ModelServiceVector dimensionMục đíchBGE-M3BgeM3EmbeddingService1024Tạo text vector cho docs/caption search.SigLIP imageImageEmbeddingService768Tạo image vector từ ảnh upload.SigLIP textSiglipTextEmbeddingService768Tạo text vector để tìm ảnh theo image_vector.5.11. Tích hợp Gemini LLM

Gemini LLM là thành phần được sử dụng để giúp hệ thống hiểu câu hỏi và sinh câu trả lời cuối cùng cho người dùng. Trong project, Gemini được tích hợp thông qua GeminiClient. Model sử dụng được cấu hình trong backend, giúp hệ thống có thể thay đổi model khi cần mà không phải sửa trực tiếp trong luồng xử lý.

Gemini được dùng ở ba vai trò chính. Thứ nhất, hệ thống dùng Gemini để phân tích câu hỏi văn bản trong luồng text_only, nhằm xác định người dùng đang hỏi gì và cần truy xuất loại dữ liệu nào. Thứ hai, Gemini được dùng trong luồng image_text để phân tích mối quan hệ giữa hình ảnh và câu hỏi văn bản, từ đó xác định địa điểm trong ảnh, địa điểm được nhắc trong câu hỏi và địa điểm cuối cùng cần trả lời. Thứ ba, Gemini được dùng trong AnswerGenerator để tạo câu trả lời tiếng Việt dựa trên dữ liệu đã truy xuất được từ Qdrant.

Một điểm quan trọng trong hệ thống là Gemini không được dùng để trả lời tự do hoàn toàn. Trước khi sinh câu trả lời, backend sẽ truy xuất tài liệu, hình ảnh và metadata liên quan, sau đó đưa các dữ liệu này vào prompt dưới dạng retrieval JSON. Prompt yêu cầu Gemini chỉ trả lời dựa trên dữ liệu có sẵn, không tự bịa thêm thông tin như sự kiện, giá, giờ mở cửa, địa chỉ hoặc mô tả nếu dữ liệu không cung cấp.

Ngoài ra, hệ thống cũng có cơ chế hỗ trợ nhiều API key cho Gemini. Khi một key gặp lỗi quota hoặc rate-limit, GeminiClient có thể thử key tiếp theo. Cách thiết kế này giúp hệ thống linh hoạt hơn trong quá trình demo và kiểm thử nhiều request, đồng thời vẫn đảm bảo không ghi log giá trị API key thật.

Nhờ tích hợp Gemini LLM, hệ thống có thể thực hiện cả hai nhiệm vụ quan trọng: hiểu ý định đầu vào của người dùng và sinh câu trả lời tự nhiên bằng tiếng Việt. Kết hợp với retrieval từ Qdrant và embedding model, Gemini giúp hệ thống trả lời có căn cứ hơn, hạn chế việc suy đoán hoặc tạo thông tin không có trong dữ liệu.

Thành phần LLMVai tròGeminiClientClient HTTP gọi Gemini API, hỗ trợ nhiều API key và parse response.TextUnderstandingServicePhân tích message thành rewrite_query, intent và cờ retrieval.ImageTextUnderstandingServicePhân tích ảnh + text, xác định image_place, text_place và final_place.AnswerGeneratorSinh câu trả lời cuối cùng bằng tiếng Việt dựa trên retrieval JSON.


### 5.12. Tích hợp S3 để trả về URL hình ảnh

Trong hệ thống, ảnh không được lưu trực tiếp trong Qdrant. Qdrant chỉ lưu thông tin liên kết đến ảnh thông qua trường s3_path trong payload. Trường này chứa cả tên bucket và đường dẫn file ảnh trên S3, giúp backend biết ảnh đang được lưu ở đâu để tạo đường dẫn hiển thị cho frontend.

S3Service là thành phần chịu trách nhiệm xử lý đường dẫn ảnh. Khi nhận được s3_path từ dữ liệu ảnh trong Qdrant, service này sẽ tách ra bucket và s3_key, sau đó tạo image_url tương ứng. image_url này được gắn vào từng ảnh trước khi backend trả kết quả về frontend.

Hệ thống hỗ trợ hai cách tạo URL ảnh. Nếu ảnh được cấu hình ở chế độ public, backend sẽ tạo URL công khai để frontend có thể hiển thị trực tiếp. Nếu sử dụng chế độ presigned, backend sẽ tạo URL tạm thời thông qua AWS SDK, URL này chỉ có hiệu lực trong một khoảng thời gian nhất định.

Điểm quan trọng là frontend không tự xử lý s3_path và cũng không dùng đường dẫn dạng s3:// để hiển thị ảnh. Frontend chỉ sử dụng image_url do backend trả về. Trong trường hợp backend không tạo được image_url do thiếu cấu hình S3 hoặc lỗi tạo presigned URL, request vẫn không bị dừng hoàn toàn; frontend có thể hiển thị ảnh placeholder hoặc thông báo không thể tải ảnh.

Hàm trong S3ServiceChức năngparseS3Path()Tách s3_path thành bucket/s3_bucket và s3_key.getImageUrlFromS3Path()Tạo URL ảnh theo S3_URL_MODE public hoặc presigned.attachImageUrls()Bổ sung image_url, s3_bucket và s3_key vào danh sách ảnh.buildPublicUrl()Tạo public URL nếu bucket public.buildPresignedUrl()Tạo presigned URL bằng AWS SDK.


### 5.13. Cấu trúc response trả về frontend

Response trả về frontend được chuẩn hóa để frontend có thể xử lý thống nhất trong nhiều trường hợp khác nhau. Thay vì mỗi pipeline trả về một kiểu dữ liệu riêng, hệ thống sử dụng chung một cấu trúc response gồm các thông tin như trạng thái xử lý, mã lỗi nếu có, thông báo, dữ liệu chính và danh sách câu hỏi gợi ý. Cách thiết kế này giúp frontend dễ dàng render kết quả, hiển thị lỗi hoặc hiển thị câu trả lời mà không cần xử lý quá nhiều định dạng khác nhau.

Trong hệ thống, các trạng thái phản hồi chính gồm thành công, lỗi, ngoài phạm vi xử lý, cần làm rõ câu hỏi và kết quả có độ tin cậy thấp. Một số trường hợp như out_of_scope hoặc low_confidence không được xem là lỗi hệ thống, mà là trạng thái nghiệp vụ. Vì vậy backend có thể trả request thành công về mặt kỹ thuật, nhưng nội dung response vẫn cho frontend biết rằng hệ thống chưa đủ điều kiện để trả lời chắc chắn.

Khi xử lý thành công, dữ liệu trả về thường bao gồm mã phiên làm việc, loại input, pipeline đã xử lý, câu trả lời, thông tin địa điểm, danh sách ảnh, dữ liệu truy xuất, thông tin debug và câu hỏi gợi ý. Với luồng image_only, response có thêm ảnh được match và câu hỏi mặc định. Với luồng image_text, response có thể chứa thêm thông tin về ảnh match và xung đột nếu hình ảnh và văn bản đang nhắc đến hai địa điểm khác nhau.

Đối với dữ liệu ảnh, backend cũng chuẩn hóa các trường cần thiết để frontend có thể hiển thị trong ImageGallery. Mỗi ảnh có thể gồm mã ảnh, tên địa điểm, đường dẫn image_url, caption, location_id, điểm tương đồng và thứ hạng. Frontend chỉ cần sử dụng image_url do backend trả về để hiển thị ảnh, không cần tự xử lý s3_path hay logic liên quan đến S3.

Trường ApiResponseÝ nghĩasuccesstrue nếu xử lý thành công; false nếu lỗi hoặc trạng thái đặc biệt.statusok, error, out_of_scope, need_clarification hoặc low_confidence.error_codeMã lỗi định danh như EMPTY_INPUT, LLM_CLASSIFICATION_ERROR, QDRANT_SEARCH_ERROR.messageThông báo ngắn cho frontend hoặc debug.dataPayload chi tiết của pipeline.suggested_questionsDanh sách câu hỏi gợi ý tiếp theo.Nhìn chung, phần backend đã được xây dựng theo hướng phân lớp rõ ràng và phù hợp với mục tiêu của đồ án. Server Express đảm nhiệm tiếp nhận request; controller điều phối pipeline; service xử lý nghiệp vụ; repository truy xuất Qdrant; embedding service tạo vector; Gemini service hiểu câu hỏi và sinh câu trả lời; S3Service tạo URL ảnh; responseFormatter chuẩn hóa kết quả trả về frontend. Cách tổ chức này giúp hệ thống dễ mở rộng, dễ kiểm thử và giảm rủi ro LLM trả lời không dựa trên dữ liệu.


## KẾT LUẬN

Sau quá trình phân tích, thiết kế và xây dựng, đề tài Travel AI Assistant đã hình thành một hệ thống trợ lý du lịch có khả năng tiếp nhận câu hỏi bằng văn bản, hình ảnh hoặc kết hợp cả văn bản và hình ảnh. Hệ thống được xây dựng theo hướng ứng dụng thực tế, trong đó frontend đảm nhiệm giao diện hội thoại còn backend chịu trách nhiệm xử lý nghiệp vụ AI, truy xuất dữ liệu và chuẩn hóa kết quả trả về.

Nội dung kết luận này tổng hợp lại các kết quả đã đạt được, những phần đã hoàn thành trong project, các hạn chế còn tồn tại và định hướng nâng cấp trong tương lai. Các nhận xét được đưa ra dựa trên hiện trạng project, bao gồm frontend ReactTS + Vite trong apps/web và backend NodeJS + Express trong apps/api.


### 1. Tổng kết kết quả đạt được

Đề tài đã xây dựng được một hệ thống Travel AI Assistant có kiến trúc tương đối hoàn chỉnh, có khả năng xử lý đa dạng kiểu đầu vào và trả lời người dùng dựa trên dữ liệu truy xuất được. Thay vì chỉ dùng mô hình ngôn ngữ lớn để sinh câu trả lời tự do, hệ thống kết hợp mô hình embedding, cơ sở dữ liệu vector Qdrant và Gemini LLM để tạo luồng xử lý theo hướng retrieval augmented generation. Cách tiếp cận này giúp câu trả lời có căn cứ hơn, giảm rủi ro bịa thông tin và phù hợp với bài toán hỏi đáp du lịch.

Về phía backend, hệ thống đã được tổ chức theo mô hình rõ ràng gồm controller, service, repository, pipeline, llm, embeddings, guards, config và utils. Endpoint chính POST /api/chat đã có khả năng nhận multipart/form-data từ frontend, bao gồm session_id, message và image. Dựa trên dữ liệu đầu vào, InputRouterService phân loại request thành text_only, image_only, image_text hoặc empty_input. Sau đó ChatController điều phối request đến pipeline phù hợp.

Ba luồng xử lý chính đã được xây dựng. Luồng text_only xử lý câu hỏi bằng văn bản, dùng Gemini để hiểu ý định, dùng BGE-M3 để tạo text embedding, truy xuất text_collection và có thể dùng hybrid image search khi người dùng muốn xem ảnh. Luồng image_only xử lý ảnh upload, dùng SigLIP image embedding để tìm ảnh tương tự trong image_collection, kiểm tra độ tin cậy, lấy metadata từ location_info và truy xuất tài liệu liên quan. Luồng image_text xử lý đồng thời ảnh và câu hỏi văn bản, có khả năng xác định địa điểm từ ảnh, phân tích câu hỏi, phát hiện tình huống ảnh và text đề cập đến hai địa điểm khác nhau, sau đó truy xuất dữ liệu phù hợp.

Về phía frontend, project đã có giao diện chat bằng ReactTS + Vite, gồm các component như ChatPage, ChatWindow, ChatInput, ImageUploadBox, BotMessage, UserMessage, ImageGallery, LocationInfoPanel, SuggestedQuestions và ErrorMessage. Frontend gửi dữ liệu đến backend bằng FormData và render kết quả theo ApiResponse contract. Người dùng có thể nhập câu hỏi, chọn ảnh, gửi request và nhận câu trả lời, ảnh liên quan, thông tin địa điểm hoặc thông báo lỗi rõ ràng.

Ngoài ra, hệ thống đã tích hợp các dịch vụ bên ngoài cần thiết. Qdrant external được dùng làm vector database với các collection chính là location_info, image_collection và text_collection. BGE-M3 và SigLIP được dùng làm embedding model thật thông qua @huggingface/transformers. Gemini được dùng cho Text Understanding, Image Text Understanding và Answer Generator. S3Service được xây dựng để chuyển s3_path trong payload ảnh thành image_url cho frontend hiển thị.

Ngoài các chức năng xử lý hỏi đáp chính, đề tài cũng đã xây dựng được quy trình thu thập, chuẩn bị và lưu trữ dữ liệu phục vụ cho hệ thống Travel AI Assistant. Dữ liệu trong hệ thống không chỉ bao gồm nội dung văn bản mô tả địa điểm du lịch mà còn có dữ liệu hình ảnh và metadata liên quan đến từng địa điểm. Các hình ảnh sau khi được chuẩn bị được lưu trữ trên S3, giúp hệ thống có thể quản lý ảnh tách biệt với backend và dễ dàng tạo đường dẫn image_url để frontend hiển thị cho người dùng. Việc sử dụng S3 trong hệ thống góp phần giúp quá trình lưu trữ, truy xuất và hiển thị hình ảnh trở nên rõ ràng, thuận tiện hơn.

Bên cạnh đó, hệ thống đã xây dựng được pipeline xử lý dữ liệu embedding để đưa dữ liệu vào cơ sở dữ liệu vector Qdrant. Với dữ liệu văn bản, hệ thống sử dụng mô hình BGE-M3 để tạo text embedding, sau đó lưu vector vào text_collection nhằm phục vụ quá trình tìm kiếm tài liệu liên quan. Với dữ liệu hình ảnh, hệ thống sử dụng SigLIP để tạo image embedding và lưu vào image_collection, giúp hệ thống có thể tìm kiếm ảnh tương tự khi người dùng gửi ảnh hoặc yêu cầu tìm ảnh bằng văn bản. Ngoài ra, metadata địa điểm được lưu trong location_info để hỗ trợ việc xác định thông tin địa điểm, liên kết giữa ảnh, tài liệu và câu trả lời cuối cùng.

Việc xây dựng pipeline embedding và lưu trữ dữ liệu trên Qdrant là một phần quan trọng trong hệ thống, vì đây là nền tảng cho các chức năng retrieval. Nhờ có các vector đã được tạo sẵn và lưu trong Qdrant, backend có thể truy xuất nhanh các tài liệu, hình ảnh và thông tin địa điểm phù hợp với câu hỏi hoặc hình ảnh đầu vào của người dùng. Điều này giúp hệ thống không chỉ trả lời dựa trên khả năng sinh ngôn ngữ của Gemini, mà còn dựa trên dữ liệu đã được thu thập, xử lý và lưu trữ trong cơ sở dữ liệu vector.

Có thể thấy, đề tài không chỉ dừng lại ở việc xây dựng giao diện chat và backend xử lý request, mà còn hoàn thành được các thành phần nền tảng của một hệ thống RAG đa phương thức. Các bước từ thu thập dữ liệu, lưu trữ hình ảnh trên S3, tạo embedding cho văn bản và hình ảnh, lưu vector vào Qdrant, truy xuất dữ liệu liên quan và sinh câu trả lời bằng LLM đã tạo thành một luồng xử lý tương đối đầy đủ. Đây là cơ sở quan trọng để hệ thống có thể mở rộng thêm dữ liệu du lịch, cải thiện chất lượng tìm kiếm và nâng cao độ chính xác của câu trả lời trong tương lai.


### 2. Những phần đã hoàn thành

Trong phạm vi đồ án, hệ thống đã hoàn thành nhiều thành phần quan trọng cả ở backend và frontend. Các phần này tạo thành một sản phẩm có thể chạy thử và kiểm chứng các luồng chính của bài toán trợ lý du lịch.

Hoàn thành backend NodeJS + Express thuần JavaScript, không dùng TypeScript, có cấu trúc thư mục theo hướng MVC + Service + Repository + Pipeline.

Hoàn thành cấu hình server qua env.js, bao gồm APP_PORT, API_PREFIX, QDRANT_URL, QDRANT_API_KEY, tên collection Qdrant, GEMINI_API_KEYS, GEMINI_MODEL, cấu hình S3 và cấu hình embedding model.

Hoàn thành endpoint GET /api/health và GET /api/health/qdrant để kiểm tra trạng thái backend và kết nối Qdrant.

Hoàn thành endpoint chính POST /api/chat nhận multipart/form-data với session_id, message và image.

Hoàn thành InputRouterService để phân loại input thành text_only, image_only, image_text và empty_input.

Hoàn thành TextOnlyPipeline, ImageOnlyPipeline và ImageTextPipeline để xử lý ba luồng đầu vào chính.

Hoàn thành TextUnderstandingService và ImageTextUnderstandingService dùng Gemini để phân tích ý định và trả JSON theo schema yêu cầu.

Hoàn thành AnswerGenerator dùng Gemini để tạo câu trả lời tiếng Việt dựa trên retrieval JSON, đồng thời hạn chế trả lời ngoài dữ liệu truy xuất.

Hoàn thành ContextService để lưu context hội thoại theo session_id trong bộ nhớ.

Hoàn thành TextRepository, ImageRepository và LocationRepository để truy xuất Qdrant external.

Hoàn thành QdrantClient để gọi listCollections, searchPoints và scrollPoints, đồng thời phân loại lỗi Qdrant.

Hoàn thành tích hợp BGE-M3 text embedding và SigLIP image/text embedding bằng @huggingface/transformers.

Hoàn thành S3Service để parse s3_path, tạo public URL hoặc presigned URL và gắn image_url vào ảnh trả về frontend.

Hoàn thành response contract thống nhất gồm success, status, error_code, message, data và suggested_questions.

Hoàn thành frontend ReactTS + Vite với giao diện chat, upload ảnh, render bot/user message, image gallery, thông tin địa điểm, câu hỏi gợi ý và thông báo lỗi.

Hoàn thành quá trình thu thập dữ liệu phục vụ cho hệ thống Travel AI Assistant, bao gồm dữ liệu văn bản mô tả địa điểm du lịch, dữ liệu hình ảnh và các metadata liên quan đến địa điểm.

Hoàn thành bước chuẩn bị và tổ chức dữ liệu theo từng địa điểm, giúp hệ thống có thể liên kết giữa thông tin văn bản, hình ảnh và location_id trong quá trình truy xuất dữ liệu.

Hoàn thành lưu trữ dữ liệu hình ảnh trên S3, giúp tách biệt phần lưu trữ ảnh với backend và hỗ trợ frontend hiển thị ảnh thông qua image_url.

Hoàn thành việc chuẩn hóa đường dẫn ảnh bằng s3_path, từ đó backend có thể parse thành s3_bucket, s3_key và tạo public URL hoặc presigned URL thông qua S3Service.

Hoàn thành pipeline xử lý dữ liệu văn bản để tạo text embedding bằng BGE-M3, sau đó lưu vector vào text_collection trong Qdrant phục vụ tìm kiếm tài liệu.

Hoàn thành pipeline xử lý dữ liệu hình ảnh để tạo image embedding bằng SigLIP, sau đó lưu vector vào image_collection trong Qdrant phục vụ tìm kiếm ảnh tương tự.

Hoàn thành việc lưu metadata địa điểm vào collection location_info, giúp hệ thống có thể truy xuất thông tin địa điểm theo location_id khi xử lý câu hỏi hoặc hình ảnh đầu vào.

Hoàn thành liên kết giữa dữ liệu văn bản, dữ liệu hình ảnh và metadata thông qua location_id, giúp các pipeline text_only, image_only và image_text có thể truy xuất đúng dữ liệu liên quan.

Hoàn thành nền tảng dữ liệu cho cơ chế retrieval, trong đó hệ thống có thể tìm kiếm tài liệu từ text_collection, tìm kiếm hình ảnh từ image_collection và lấy thông tin địa điểm từ location_info.

Hoàn thành quy trình chuẩn bị dữ liệu đầu vào cho mô hình LLM, giúp Gemini sinh câu trả lời dựa trên dữ liệu đã truy xuất thay vì trả lời tự do không có căn cứ

Nhóm chức năngKết quả đã hoàn thànhBackend APIExpress server, /api/chat, health endpoint, qdrant health endpoint, debug endpoint.Pipeline AItext_only, image_only, image_text.RepositoryTextRepository, ImageRepository, LocationRepository truy xuất Qdrant.ModelGemini LLM, BGE-M3 embedding, SigLIP embedding.ẢnhUpload ảnh bằng multer memoryStorage, tạo image_url bằng S3Service.FrontendChat UI, upload image, render ApiResponse contract.3. Những hạn chế còn tồn tại

Mặc dù hệ thống đã hoàn thành các luồng xử lý cốt lõi, project vẫn còn một số hạn chế cần được nhìn nhận rõ. Những hạn chế này chủ yếu đến từ phạm vi đồ án, đặc thù của hệ thống AI và việc hệ thống hiện vẫn đang ở mức phát triển thử nghiệm.

Hạn chế đầu tiên là context hội thoại hiện được lưu bằng Map trong bộ nhớ thông qua ContextService. Cách làm này đơn giản và phù hợp cho demo, nhưng khi server restart thì toàn bộ context sẽ mất. Nếu hệ thống được triển khai thật, cần có cơ chế lưu context bền vững hơn, ví dụ Redis hoặc database.

Hạn chế thứ hai là hệ thống phụ thuộc nhiều vào các dịch vụ bên ngoài. Qdrant, Gemini API, S3 và quá trình tải model từ Hugging Face đều cần cấu hình đúng và kết nối ổn định. Nếu Qdrant không truy cập được, collection thiếu, vector name sai hoặc Gemini hết quota, pipeline có thể trả lỗi hoặc không tạo được câu trả lời như mong muốn.

Hạn chế thứ ba nằm ở tốc độ xử lý model embedding. Vì backend chạy embedding model bằng @huggingface/transformers trong NodeJS, lần chạy đầu tiên có thể mất nhiều thời gian để tải model về cache. Ngoài ra, việc chạy model trên CPU có thể khiến request xử lý chậm, đặc biệt với ảnh hoặc máy có cấu hình thấp.

Hạn chế thứ tư là chất lượng câu trả lời phụ thuộc mạnh vào chất lượng dữ liệu trong Qdrant. Nếu dữ liệu trong text_collection thiếu nội dung, metadata trong location_info chưa đầy đủ hoặc ảnh trong image_collection chưa được embedding đúng, kết quả retrieval và câu trả lời cuối cùng sẽ bị ảnh hưởng. Hệ thống đã có cơ chế báo chưa đủ dữ liệu, nhưng điều đó cũng cho thấy dữ liệu cần tiếp tục được bổ sung và đánh giá.

Hạn chế thứ năm là LLM đôi khi có thể trả sai định dạng JSON trong bước understanding, đặc biệt ở luồng image_text. Khi Gemini không trả đúng schema mà backend yêu cầu, pipeline sẽ trả LLM_CLASSIFICATION_ERROR. Đây là vấn đề thường gặp khi tích hợp LLM theo kiểu yêu cầu JSON nghiêm ngặt.

Ngoài ra, hệ thống hiện chưa có các chức năng phục vụ triển khai sản phẩm thực tế như đăng nhập người dùng, phân quyền, lưu lịch sử chat lâu dài, giới hạn tần suất request, giám sát hệ thống, logging nâng cao, thống kê chất lượng câu trả lời hoặc cơ chế đánh giá tự động độ chính xác retrieval. Frontend đã có giao diện chat cơ bản nhưng vẫn có thể tiếp tục cải thiện trải nghiệm người dùng, trạng thái loading và cách trình bày dữ liệu.


### 4. Định hướng nâng cấp trong tương lai

Trong tương lai, hệ thống có thể được nâng cấp theo nhiều hướng để tăng tính ổn định, độ chính xác và khả năng triển khai thực tế. Trước hết, cần cải thiện tầng lưu trữ context và lịch sử hội thoại. Thay vì lưu context trong RAM, hệ thống có thể dùng Redis hoặc database để lưu session, lịch sử chat, địa điểm đang active và các ảnh đã trả về. Điều này giúp người dùng có thể tiếp tục hội thoại ngay cả khi backend restart.

Một hướng nâng cấp quan trọng là cải thiện độ ổn định của LLM JSON output. Backend có thể bổ sung cơ chế retry khi Gemini trả sai JSON, tự sửa JSON nhẹ trong phạm vi an toàn, hoặc dùng chiến lược validate và yêu cầu Gemini trả lại đúng schema. Điều này đặc biệt hữu ích cho TextUnderstandingService và ImageTextUnderstandingService, vì các service này là bước quyết định pipeline cần truy xuất dữ liệu như thế nào.

Về retrieval, hệ thống có thể bổ sung reranking để sắp xếp lại kết quả tài liệu và ảnh trước khi đưa vào AnswerGenerator. Ngoài việc dùng score từ Qdrant, backend có thể kết hợp thêm metadata, độ phù hợp theo intent, mức độ trùng khớp location_id hoặc mô hình reranker riêng. Điều này giúp câu trả lời cuối cùng có dữ liệu đầu vào chính xác hơn.

Về embedding và hiệu năng, có thể tách model embedding thành một service riêng hoặc dùng hạ tầng tối ưu hơn cho inference. Nếu hệ thống có nhiều người dùng, việc chạy embedding trực tiếp trong NodeJS có thể không còn phù hợp. Một service chuyên xử lý embedding, có cache vector và hàng đợi xử lý ảnh, sẽ giúp backend chính nhẹ hơn và dễ mở rộng hơn.

Về dữ liệu, cần xây dựng quy trình cập nhật và đánh giá dữ liệu du lịch trong Qdrant. Các collection location_info, image_collection và text_collection nên được bổ sung thêm địa điểm, mô tả, ảnh, caption tiếng Việt/tiếng Anh và metadata liên quan. Đồng thời, cần có bộ test câu hỏi thực tế để đánh giá chất lượng retrieval và chất lượng câu trả lời.

Về frontend, có thể nâng cấp giao diện để hiển thị rõ hơn các trạng thái low_confidence, out_of_scope hoặc thiếu dữ liệu. Ngoài ra, có thể bổ sung lịch sử chat, khả năng xem chi tiết ảnh, bản đồ địa điểm, bộ lọc theo tỉnh/thành, hoặc chức năng lưu địa điểm yêu thích. Những cải tiến này sẽ giúp ứng dụng gần hơn với một sản phẩm hỗ trợ du lịch thực tế.

Cuối cùng, khi triển khai thực tế, hệ thống cần bổ sung các yếu tố vận hành như xác thực người dùng, giới hạn tần suất request, giám sát log, cảnh báo lỗi, quản lý API key an toàn và tài liệu triển khai. Đây là những yếu tố cần thiết để hệ thống có thể hoạt động ổn định ngoài môi trường phát triển.

Hướng nâng cấpMục tiêuLưu context bền vữngKhông mất hội thoại khi server restart, hỗ trợ lịch sử chat.Cải thiện LLM JSONGiảm lỗi LLM_CLASSIFICATION_ERROR, tăng độ ổn định pipeline.Reranking retrievalTăng độ chính xác của docs/images trước khi sinh câu trả lời.Tối ưu embeddingGiảm thời gian xử lý, hỗ trợ nhiều request hơn.Mở rộng dữ liệu QdrantTăng phạm vi địa điểm và chất lượng câu trả lời.Nâng cấp frontendCải thiện trải nghiệm người dùng và khả năng khai thác kết quả.Bổ sung vận hànhĐáp ứng yêu cầu triển khai thực tế và bảo trì lâu dài.Kết luận chung

Nhìn chung, Travel AI Assistant đã đạt được mục tiêu chính của đồ án là xây dựng một hệ thống trợ lý du lịch có khả năng xử lý văn bản, hình ảnh và kết hợp văn bản với hình ảnh. Hệ thống đã tích hợp được các thành phần AI quan trọng gồm Gemini LLM, BGE-M3, SigLIP và Qdrant, đồng thời có frontend để người dùng tương tác trực tiếp. Mặc dù vẫn còn một số hạn chế về hiệu năng, dữ liệu, lưu trữ context và độ ổn định của LLM output, project hiện tại đã tạo được nền tảng kỹ thuật rõ ràng để tiếp tục mở rộng trong tương lai.

Qua quá trình thực hiện đề tài, hệ thống cho thấy hướng kết hợp LLM với retrieval và embedding là phù hợp với bài toán hỏi đáp du lịch. Việc tách backend thành các pipeline, service và repository giúp project dễ bảo trì, dễ phát triển thêm và có khả năng thích nghi khi thay đổi model hoặc nguồn dữ liệu. Đây là cơ sở quan trọng để tiếp tục hoàn thiện ứng dụng thành một trợ lý du lịch thông minh hơn, ổn định hơn và hữu ích hơn cho người dùng.

