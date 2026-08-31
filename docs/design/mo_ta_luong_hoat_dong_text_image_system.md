# M? t? lu?ng ho?t ??ng h? th?ng Travel AI Assistant

T?i li?u k? thu?t backend theo code hi?n t?i

Ph?m vi: m? t? lu?ng x? l? c?a endpoint POST /api/chat v?i ba h??ng text_only, image_only v? text_image. T?i li?u ch? d?a tr?n code backend hi?n c? trong apps/api, kh?ng m? t? th?m ch?c n?ng ch?a th?y trong code.


## M?c l?c

- 1. T?ng quan ki?n tr?c x? l? request

- 2. text_only

- 3. image_only

- 4. text_image

- 5. Ghi ch? v? ph?n ch?a th?y r? trong code


## T?ng quan ki?n tr?c x? l? request

Backend l? NodeJS + Express thu?n JavaScript. File src/server.js kh?i ??ng Express app theo appConfig.port v? appConfig.apiPrefix. File src/app.js khai b?o tr?c ti?p endpoint POST ${appConfig.apiPrefix}/chat b?ng multer.memoryStorage() v?i upload.single("image"). Trong code hi?n t?i kh?ng th?y file router ri?ng cho chat; route ???c g?n tr?c ti?p trong app.js.


### Lu?ng v?o chung c?a /api/chat:


## 1. Client g?i multipart/form-data t?i POST /api/chat. C?c field ch?nh g?m session_id, message v? image.


## 2. app.js d?ng multer ??c file ?nh v?o req.file theo b? nh? t?m, kh?ng l?u file d?i h?n tr?n disk.


## 3. ChatController.handle trong src/controllers/chat.controller.js g?i inputRouterService.route() v?i sessionId=req.body.session_id, message=req.body.message v? image=req.file.


## 4. InputRouterService trong src/services/inputRouter.service.js chu?n h?a message b?ng trim(), ki?m tra c? message v? c? image hay kh?ng, sau ?? ph?n lo?i input_type.


## 5. N?u kh?ng c? c? message l?n image, controller tr? errorResponse v?i error_code EMPTY_INPUT, HTTP 400.

6. N?u input_type l? text_only, controller g?i textOnlyPipeline.run(). N?u l? image_only, controller g?i imageOnlyPipeline.run(). N?u l? image_text, controller g?i imageTextPipeline.run().


### C?c ki?u input_type trong code:


| input_type | ?i?u ki?n ph?n lo?i | Pipeline ???c g?i |
| --- | --- | --- |
| text_only | C? message, kh?ng c? image | TextOnlyPipeline trong src/pipelines/text-only.pipeline.js |
| image_only | C? image, kh?ng c? message | ImageOnlyPipeline trong src/pipelines/image-only.pipeline.js |
| image_text | C? c? message v? image | ImageTextPipeline trong src/pipelines/image-text.pipeline.js |
| empty_input | Kh?ng c? message v? kh?ng c? image | Kh?ng g?i pipeline, tr? EMPTY_INPUT |

L?u ? ??t t?n: y?u c?u t?i li?u d?ng heading text_image. Trong backend hi?n t?i, input_type th?c t? trong InputRouterService v? ChatController l? image_text. V? v?y ph?n text_image d??i ??y m? t? ??ng lu?ng code image_text.

Response contract chung ???c t?o b?i src/utils/responseFormatter.js g?m c?c tr??ng: success, status, error_code, message, data, suggested_questions. C?c status hi?n c? l? ok, error, out_of_scope, need_clarification v? low_confidence.


### C?u h?nh Qdrant v? model theo code hi?n t?i:


| Nh?m | T?n trong code | Gi? tr?/ch?c n?ng |
| --- | --- | --- |
| Qdrant collection | appConfig.qdrant.collections.location | location_info |
| Qdrant collection | appConfig.qdrant.collections.image | image_collection |
| Qdrant collection | appConfig.qdrant.collections.text | text_collection |
| Vector text docs | TEXT_VECTOR_NAME | text_vector |
| Vector ?nh | IMAGE_VECTOR_NAME | image_vector |
| Vector caption ?nh | CAPTION_VECTOR_NAME | caption_vector |
| Text embedding | BgeM3EmbeddingService | onnx-community/bge-m3-ONNX, dimension 1024 |
| Image/Text-to-image embedding | ImageEmbeddingService v? SiglipTextEmbeddingService | Xenova/siglip-base-patch16-384, dimension 768 |
| LLM | GeminiClient | D?ng GEMINI_API_KEYS ho?c GEMINI_API_KEY v? GEMINI_MODEL |


## text_only

Lu?ng n?y x? l? tr??ng h?p ng??i d?ng ch? nh?p v?n b?n. ?i?u ki?n v?o l? InputRouterService ph?n lo?i input_type=text_only v? c? message sau khi trim() v? kh?ng c? req.file.


### C?c b??c x? l?


## 1. ChatController.handle nh?n routeResult t? inputRouterService.route() v? g?i textOnlyPipeline.run({ sessionId, message, inputType }).


## 2. TextOnlyPipeline ki?m tra inputType. N?u kh?ng ph?i text_only th? tr? PIPELINE_NOT_IMPLEMENTED.


## 3. Pipeline l?y context h?i tho?i b?ng contextService.getContext(sessionId). Context ch?a old_input, old_rewrite_query, active_location_id, active_location_name, last_returned_images, last_image_place_id, last_text_place_id, last_conflict v? pending_question.


## 4. Pipeline g?i textDomainGuard.check(message, context). File src/guards/textDomain.guard.js ch? ch?n c?c tr??ng h?p ch?c ch?n ngo?i ph?m vi du l?ch d?a tr?n OUT_OF_DOMAIN_KEYWORDS. N?u message r?ng th? tr? EMPTY_INPUT. N?u ngo?i ph?m vi th? tr? outOfScopeResponse v?i error_code TEXT_NOT_TRAVEL_RELATED. C?c c?u h?i m? h? c? context v?n ???c cho ?i ti?p.


## 5. Pipeline g?i textUnderstandingService.understand({ message, context }). Khi Gemini ???c c?u h?nh, TextUnderstandingService d?ng GeminiClient.generateJson() ?? sinh JSON ??ng TEXT_UNDERSTANDING_SCHEMA.

6. Schema text understanding b?t bu?c c? c?c tr??ng rewrite_query, need_docs, need_images, need_metadata, location_id, location_name, is_follow_up v? intent. intent h?p l? g?m overview, activity, image_search, metadata, location_lookup, unknown.

7. N?u Gemini tr? JSON sai ho?c thi?u field, validateLlmResult() n?m LlmClassificationError v? pipeline tr? errorResponse v?i error_code LLM_CLASSIFICATION_ERROR.

8. Sau khi hi?u c?u h?i, pipeline g?i referenceResolver.resolve(). Service n?y x? l? follow-up d?a tr?n context, v? d? tham chi?u active_location_id/active_location_name ho?c ?nh theo rank trong last_returned_images.

9. Pipeline g?i retrievalPlanner.plan(resolvedUnderstanding). Planner chuy?n need_docs, need_images, need_metadata th?nh shouldSearchDocs, shouldSearchImages, shouldGetMetadata; ??ng th?i l?y topKDocs v? topKImages t? appConfig.retrieval.

10. N?u shouldSearchDocs=true, pipeline g?i bgeM3EmbeddingService.embedText(resolvedUnderstanding.rewrite_query) ?? t?o vector BGE-M3, sau ?? g?i textRepository.searchDocsByTextVector(). Repository t?m trong collection text_collection, vector text_vector, c? filter location_id n?u plan.finalLocationId t?n t?i.

11. N?u ch?a c? finalLocationId nh?ng docs tr? v? c? location_id, pipeline l?y location_id ??u ti?n t? docs ?? d?ng cho c?c b??c sau.

12. N?u shouldSearchImages=true, pipeline t?o ho?c t?i s? d?ng bgeTextVector, g?i siglipTextEmbeddingService.embedText() ?? t?o SigLIP text vector. Sau ?? imageRepository.hybridSearchImagesByText() t?m ?nh trong image_collection theo hai nh?nh: image_vector v?i SigLIP text vector v? caption_vector v?i BGE-M3 vector. Lu?ng text_only d?ng weights siglip=0.3 v? caption=0.7.

13. K?t qu? ?nh hybrid ???c merge theo image_id ho?c s3_path, t?nh final_score, x?p rank r?i ???c truy?n qua s3Service.attachImageUrls(). Service n?y parse s3_path th?nh s3_bucket v? s3_key, sau ?? t?o image_url theo S3_URL_MODE public ho?c presigned.

14. N?u ch?a c? finalLocationId nh?ng images tr? v? c? location_id, pipeline l?y location_id ??u ti?n t? images.

15. N?u shouldGetMetadata=true v? c? finalLocationId, pipeline g?i locationRepository.getLocationById() ?? l?y metadata trong collection location_info b?ng scrollPoints v?i filter location_id.

16. Pipeline x?c ??nh finalLocationId v? finalLocationName b?ng getFirstLocationId() v? getFirstLocationName() t? metadata, understanding, docs ho?c images.

17. Pipeline g?i fusionService.fuse() ?? gom message, rewrite_query, docs, images, metadata, plan v? debug th?nh fusedContext. Trong code hi?n t?i fusedContext ch? y?u l? object gom d? li?u, ch?a c? thu?t to?n fusion ph?c t?p.

18. Pipeline g?i answerGenerator.generate(). AnswerGenerator ch? d?ng d? li?u retrieval JSON trong prompt g?i Gemini, y?u c?u tr? l?i ti?ng Vi?t, kh?ng b?a ngo?i d? li?u, kh?ng d?ng markdown bold/italic v? kh?ng d?ng k? t? **. N?u intent kh?ng ph?i image_search m? docs r?ng, AnswerGenerator tr? c?u b?o ch?a c? ?? d? li?u m? kh?ng g?i Gemini.

19. Pipeline t?o data response g?m session_id, input_type=text_only, pipeline=text_only_pipeline, answer, location, images, retrieval, debug v? suggested_questions.

20. contextService.updateOnSuccess() c?p nh?t old_input, old_rewrite_query, active_location_id, active_location_name, last_returned_images, last_text_place_id v? last_conflict=null.

21. Pipeline tr? okResponse(data) v?i HTTP 200. N?u retrieval t?ng ph?n l?i, pipeline ghi retrieval_errors trong debug nh?ng v?n c? th? ti?p t?c n?u c?n ?? d? li?u ?? sinh answer.


### B?ng t?m t?t text_only


| M?c | N?i dung |
| --- | --- |
| Input | multipart/form-data c? session_id v? message; kh?ng c? image. |
| Th?nh ph?n x? l? ch?nh | ChatController, InputRouterService, TextOnlyPipeline, TextDomainGuard, TextUnderstandingService, ReferenceResolver, RetrievalPlanner, BgeM3EmbeddingService, SiglipTextEmbeddingService, TextRepository, ImageRepository, LocationRepository, S3Service, FusionService, AnswerGenerator, ContextService. |
| Collection Qdrant s? d?ng | text_collection khi need_docs=true; image_collection khi need_images=true; location_info khi need_metadata=true v? c? location_id. |
| Output tr? v? | ApiResponse status ok/out_of_scope/error/need_clarification. Khi ok, data c? answer, location, images, retrieval, debug v? suggested_questions. |


## image_only

Lu?ng n?y x? l? tr??ng h?p ng??i d?ng ch? g?i ?nh. ?i?u ki?n v?o l? InputRouterService ph?n lo?i input_type=image_only v? c? req.file v? kh?ng c? message.


### C?c b??c x? l?


## 1. ChatController.handle g?i imageOnlyPipeline.run({ sessionId, inputType, image }).


## 2. ImageOnlyPipeline ki?m tra inputType. N?u kh?ng ph?i image_only th? tr? PIPELINE_NOT_IMPLEMENTED.


## 3. Pipeline g?i validateUploadedImage(image). H?m n?y y?u c?u image c? buffer v? mimetype b?t ??u b?ng image/. N?u thi?u ?nh tr? EMPTY_INPUT, n?u kh?ng ph?i ?nh tr? UNSUPPORTED_FILE_TYPE.


## 4. Pipeline g?i imageEmbeddingService.embedImage(image). Service n?y d?ng SiglipImageModelClient trong src/embeddings/embedding.client.js ?? decode ?nh b?ng RawImage, ch?y SiglipVisionModel v? tr? vector ?nh dimension 768.


## 5. Pipeline g?i imageRepository.searchImagesByImageVector({ imageVector, topK }). Repository t?m trong collection image_collection, vector name image_vector, source image_vector, topK l?y t? appConfig.retrieval.topKImages.

6. Ngay sau search ?nh, pipeline b?t bu?c g?i s3Service.attachImageUrls(rawMatches). Service n?y ??c payload.s3_path, parse th?nh s3_bucket v? s3_key, r?i t?o image_url. N?u kh?ng t?o ???c URL th? image_url c? th? l? null nh?ng pipeline v?n ti?p t?c theo metadata.

7. Pipeline g?i confidenceGuard.checkImageMatch(matchedImages). Guard d?ng imageMatchThreshold v? imageLowConfidenceThreshold t? appConfig.retrieval. N?u score ?nh ??u ti?n >= imageMatchThreshold th? passed=true. N?u th?p h?n th? pipeline tr? lowConfidenceResponse v?i error_code LOW_CONFIDENCE_MATCH v? danh s?ch candidate images.

8. N?u match ?? tin c?y, pipeline l?y matchedImage=matchedImages[0] v? locationId t? matchedImage.location_id. N?u kh?ng c? location_id, pipeline tr? lowConfidenceResponse v?i error_code IMAGE_LOCATION_NOT_FOUND.

9. Pipeline g?i locationRepository.getLocationById(locationId) ?? l?y metadata ??a ?i?m t? collection location_info. N?u l?i Qdrant, l?i ???c ghi v?o retrievalErrors.

10. Pipeline t?o default query b?ng h?ng IMAGE_ONLY_DEFAULT_QUERY: ???y l? ??a ?i?m n?o v? th?ng tin t?ng quan l? g???.

11. Pipeline g?i bgeM3EmbeddingService.embedText(IMAGE_ONLY_DEFAULT_QUERY) ?? t?o vector text, sau ?? g?i textRepository.searchDocsByTextVector({ textVector, locationId, topK }) ?? t?m t?i li?u trong text_collection, vector text_vector, c? filter location_id ??ng v?i ??a ?i?m ?? match t? ?nh.

12. Pipeline g?i fusionService.fuse() ?? gom default query, docs, matchedImages, metadata, plan v? debug.

13. Pipeline g?i answerGenerator.generate() v?i intent overview. N?u docs r?ng, AnswerGenerator tr? c?u b?o ch?a c? ?? d? li?u trong h? th?ng. N?u c? docs, AnswerGenerator g?i Gemini ?? sinh c?u tr? l?i ti?ng Vi?t d?a tr?n retrieval JSON.

14. Pipeline t?o suggested_questions theo locationName n?u c?, v? d? h?i ??a ?i?m c? g? ??p, c? g? ch?i ho?c xem th?m ?nh.

15. Pipeline t?o data g?m session_id, input_type=image_only, pipeline=image_only_pipeline, default_query, answer, location, matched_image, images, retrieval v? debug. debug c? uploaded_image, docs_count, images_count, top_score, used_collections v? retrieval_errors.

16. contextService.updateOnSuccess() c?p nh?t old_input="[image_only]", old_rewrite_query=IMAGE_ONLY_DEFAULT_QUERY, active_location_id, active_location_name, last_returned_images, last_text_place_id v? last_conflict=null.

17. Pipeline tr? okResponse(data) v?i HTTP 200.


### B?ng t?m t?t image_only


| M?c | N?i dung |
| --- | --- |
| Input | multipart/form-data c? session_id v? image; kh?ng c? message. Image ???c multer ??a v?o req.file trong b? nh?. |
| Th?nh ph?n x? l? ch?nh | ChatController, InputRouterService, ImageOnlyPipeline, ImageEmbeddingService, ImageRepository, S3Service, ConfidenceGuard, LocationRepository, BgeM3EmbeddingService, TextRepository, FusionService, AnswerGenerator, ContextService. |
| Collection Qdrant s? d?ng | image_collection ?? match ?nh b?ng image_vector; location_info ?? l?y metadata theo location_id; text_collection ?? l?y docs b?ng text_vector v?i filter location_id. |
| Output tr? v? | N?u score th?p: status low_confidence. N?u ?? tin c?y: status ok, data c? answer, location, matched_image, images, retrieval, debug v? suggested_questions. |


## text_image

Lu?ng n?y m? t? tr??ng h?p ng??i d?ng g?i c? v?n b?n v? ?nh. Trong code backend hi?n t?i, t?n input_type l? image_text v? pipeline l? image_text_pipeline. Heading text_image ???c d?ng theo y?u c?u t?i li?u, nh?ng t?t c? t?n class/file/h?m b?n d??i gi? ??ng theo code.


### C?c b??c x? l?


## 1. ChatController.handle nh?n routeResult.input_type=image_text t? InputRouterService v? g?i imageTextPipeline.run({ sessionId, message, inputType, image }).


## 2. ImageTextPipeline ki?m tra inputType. N?u kh?ng ph?i image_text th? tr? PIPELINE_NOT_IMPLEMENTED.


## 3. Pipeline g?i validateUploadedImage(image) d?ng l?i t? image-only.pipeline.js. N?u thi?u ?nh ho?c mimetype kh?ng ph?i image/* th? tr? EMPTY_INPUT ho?c UNSUPPORTED_FILE_TYPE.


## 4. Pipeline l?y context b?ng contextService.getContext(sessionId) v? kh?i t?o retrievalDebug v?i used_collections ban ??u l? image_collection.


## 5. Pipeline g?i imageEmbeddingService.embedImage(image) ?? t?o SigLIP image vector dimension 768.

6. Pipeline g?i imageRepository.searchImagesByImageVector() ?? t?m ?nh t??ng t? trong image_collection b?ng vector image_vector.

7. Pipeline g?i s3Service.attachImageUrls(rawMatches) ?? b? sung image_url, s3_bucket v? s3_key t? payload.s3_path.

8. Pipeline g?i evaluateImageConfidence(matchedImages). Kh?c image_only, image_text t? ph?n bi?t hai m?c: n?u topScore < imageLowConfidenceThreshold th? tr? outOfScopeResponse v?i error_code IMAGE_NOT_TRAVEL_RELATED; n?u topScore < imageMatchThreshold th? tr? lowConfidenceResponse v?i error_code LOW_CONFIDENCE_MATCH; n?u ??t ng??ng th? ?i ti?p.

9. Pipeline l?y matchedImage=matchedImages[0] v? imagePlace g?m location_id, location_name t? ?nh match. N?u ?nh match kh?ng c? location_id, pipeline tr? lowConfidenceResponse v?i error_code IMAGE_LOCATION_NOT_FOUND.

10. Pipeline t?o imageContext b?ng context hi?n t?i c?ng v?i active_location_id, active_location_name, last_image_place_id v? last_returned_images t? ?nh ?? match.

11. Pipeline g?i textDomainGuard.check(message, imageContext). N?u text ch?c ch?n ngo?i ph?m vi du l?ch, pipeline tr? outOfScopeResponse v?i error_code TEXT_NOT_TRAVEL_RELATED, nh?ng v?n c? matched_image trong data debug.

12. Pipeline g?i imageTextUnderstandingService.understand({ message, imagePlace, context: imageContext }). Khi Gemini ???c c?u h?nh, service d?ng GeminiClient.generateJson() theo IMAGE_TEXT_UNDERSTANDING_SCHEMA.

13. Schema image_text understanding b?t bu?c c? rewrite_query, need_docs, need_images, need_metadata, image_place_id, image_place_name, text_place_id, text_place_name, final_place_id, final_place_name, is_reference_question, is_specific_place_question v? intent. intent h?p l? g?m overview, activity, image_search, metadata, location_lookup, comparison, unknown.

14. N?u Gemini tr? JSON sai ho?c thi?u field, pipeline tr? errorResponse v?i error_code LLM_CLASSIFICATION_ERROR.

15. Pipeline g?i enrichUnderstandingLocation(). N?u understanding c? text_place_name nh?ng ch?a c? text_place_id, service g?i locationRepository.findLocationByName() ?? d? trong location_info. H?m n?y scroll t?i ?a 200 ?i?m v? so kh?p normalizeText v?i location_name, location_key ho?c title_name.

16. Pipeline g?i imageTextResolver.resolve(). Resolver quy?t ??nh final_place_id/final_place_name t? ??a ?i?m trong ?nh v? ??a ?i?m trong text. N?u text nh?c ??a ?i?m kh?c ?nh, resolver t?o conflict c? conflict_type=image_text_place_mismatch. N?u c?u h?i l? tham chi?u ki?u ?? ??y?, ?trong ?nh?, resolver ?u ti?n imagePlace.

17. Pipeline g?i buildPlan(resolved). Plan g?m shouldSearchDocs, shouldSearchImages, shouldGetMetadata, finalLocationId, finalLocationName, topKDocs, topKImages v? intent.

18. N?u shouldSearchDocs=true, pipeline g?i bgeM3EmbeddingService.embedText(resolved.rewrite_query) r?i textRepository.searchDocsByTextVector() trong text_collection b?ng text_vector, filter theo finalLocationId n?u c?.

19. N?u shouldSearchImages=true, pipeline b?t debug.hybrid_image_search.used=true v? branches g?m siglip_text_to_image_vector, caption_bge_m3_vector. Pipeline t?o bgeTextVector n?u ch?a c?, t?o siglipTextVector b?ng siglipTextEmbeddingService.embedText(), r?i g?i imageRepository.hybridSearchImagesByText() v?i weights siglip=0.5 v? caption=0.5.

20. Hybrid image search trong ImageRepository t?m song song trong image_collection b?ng image_vector cho SigLIP text-to-image v? caption_vector cho BGE-M3 caption vector, sau ?? merge k?t qu?, t?nh final_score v? rank. K?t qu? relatedImages ???c b? sung image_url qua s3Service.attachImageUrls().

21. N?u shouldGetMetadata=true v? c? finalLocationId, pipeline g?i locationRepository.getLocationById() ?? l?y metadata t? location_info.

22. Pipeline ch?n responseImages: n?u plan.shouldSearchImages=true th? d?ng relatedImages; n?u kh?ng th? tr? v? matchedImage ban ??u trong m?ng images.

23. Pipeline x?c ??nh finalLocationName b?ng getFinalLocationName() t? metadata, resolved, images ho?c docs.

24. Pipeline t?o responsePlan c? th?m conflict, r?i g?i fusionService.fuse() ?? gom d? li?u retrieval v? resolution.

25. Pipeline g?i answerGenerator.generate() v?i resolution g?m image_place_id, image_place_name, text_place_id, text_place_name, final_place_id, final_place_name v? conflict. N?u conflict_type=image_text_place_mismatch, prompt c? answer_hint y?u c?u n?u ng?n g?n ?nh v? text ?ang nh?c hai ??a ?i?m kh?c nhau r?i tr? l?i theo final_place_name.

26. Pipeline t?o data g?m session_id, input_type=image_text, pipeline=image_text_pipeline, answer, location, matched_image, images, retrieval, debug v? suggested_questions. debug l?u matched_image_id, image_place_id/name, text_place_id/name, final_place_id/name, image_similarity_score, docs_count, images_count, used_collections, hybrid_image_search, retrieval_errors v? conflict.

27. contextService.updateOnSuccess() c?p nh?t old_input, old_rewrite_query, active_location_id=resolved.final_place_id, active_location_name, last_image_place_id, last_text_place_id, last_returned_images v? last_conflict.

28. Pipeline tr? okResponse(data) v?i HTTP 200.


### B?ng t?m t?t text_image


| M?c | N?i dung |
| --- | --- |
| Input | multipart/form-data c? session_id, message v? image. Backend ph?n lo?i l? input_type=image_text. |
| Th?nh ph?n x? l? ch?nh | ChatController, InputRouterService, ImageTextPipeline, ImageEmbeddingService, ImageRepository, S3Service, TextDomainGuard, ImageTextUnderstandingService, ImageTextResolver, BgeM3EmbeddingService, SiglipTextEmbeddingService, TextRepository, LocationRepository, FusionService, AnswerGenerator, ContextService. |
| Collection Qdrant s? d?ng | image_collection ?? match ?nh ban ??u b?ng image_vector v? t?m ?nh li?n quan b?ng hybrid search; text_collection ?? t?m docs b?ng text_vector; location_info ?? d?/t?i metadata ??a ?i?m. |
| Output tr? v? | C? th? tr? out_of_scope n?u ?nh ho?c text ngo?i ph?m vi, low_confidence n?u ?nh ch?a ?? tin c?y, error n?u LLM/Qdrant l?i n?ng, ho?c ok v?i answer, location, matched_image, images, retrieval, debug v? suggested_questions. |


## Ghi ch? v? ph?n ch?a th?y r? trong code

- Kh?ng th?y file router ri?ng cho chat nh? src/routes/chat.routes.js; endpoint /api/chat ?ang ???c khai b?o tr?c ti?p trong src/app.js.

- TravelQueryPipeline trong src/pipelines/travel-query.pipeline.js hi?n l? placeholder v? kh?ng ???c ChatController d?ng cho ba lu?ng ch?nh.

- TextUnderstandingService v? ImageTextUnderstandingService c? fallback heuristic trong class, nh?ng singleton ?ang d?ng m?c ??nh useFallbackWhenNotConfigured=false. Ngh?a l? flow th?c t? c?n Gemini ???c c?u h?nh, tr? khi test ho?c code kh?c inject option fallback.

- FusionService hi?n ch? gom d? li?u retrieval v?o m?t object; ch?a th?y thu?t to?n fusion n?ng cao trong code.

- T?i li?u n?y d?ng collection image_collection v? ?? l? gi? tr? m?c ??nh trong appConfig hi?n t?i. N?u .env ??i QDRANT_IMAGE_COLLECTION th? backend s? d?ng gi? tr? t? .env.

