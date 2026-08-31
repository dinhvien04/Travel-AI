# CẤU TRÚC ĐỀ TÀI / BÁO CÁO TRAVEL AI ASSISTANT

## MỞ ĐẦU
- Lý do chọn đề tài
- Mục tiêu đề tài
- Đối tượng và phạm vi nghiên cứu
- Phương pháp thực hiện
- Kết quả mong đợi

---

## CHƯƠNG 1: TỔNG QUAN VỀ ĐỀ TÀI VÀ CƠ SỞ CÔNG NGHỆ
- **1.1. Giới thiệu đề tài Travel AI Assistant**
- **1.2. Bài toán hỗ trợ hỏi đáp du lịch bằng văn bản và hình ảnh**
- **1.3. Những khó khăn trong bài toán**
  - Hiểu đúng câu hỏi của người dùng
  - Xử lý ngữ cảnh hội thoại
  - Tìm kiếm tài liệu liên quan
  - Tìm kiếm hình ảnh tương ứng
  - Sinh câu trả lời dựa trên dữ liệu, hạn chế bịa thông tin
- **1.4. Tổng quan các công nghệ sử dụng**
  - ReactTS và Vite
  - NodeJS và Express
  - Qdrant Vector Database
  - Gemini LLM
  - BGE-M3
  - SigLIP
  - Amazon S3
- **1.5. Cơ sở lý thuyết liên quan**
  - Mô hình RAG (Retrieval-Augmented Generation)
  - Vector embedding
  - Text embedding
  - Image embedding
  - Hybrid search
  - Vector database
  - Mô hình MVC, Service, Repository và Pipeline

---

## CHƯƠNG 2: THU THẬP DỮ LIỆU VÀ XÂY DỰNG KHO DỮ LIỆU
- **2.1. Mục tiêu của quá trình thu thập dữ liệu**
- **2.2. Các loại dữ liệu sử dụng trong hệ thống**
  - Dữ liệu văn bản mô tả địa điểm du lịch
  - Dữ liệu hình ảnh địa điểm
  - Metadata của địa điểm
  - Thông tin liên kết giữa ảnh, tài liệu và địa điểm
- **2.3. Quy trình thu thập và chuẩn bị dữ liệu**
- **2.4. Chuẩn hóa dữ liệu văn bản**
- **2.5. Chuẩn hóa dữ liệu hình ảnh**
- **2.6. Thiết kế dữ liệu lưu trữ trên Qdrant**
  - Collection lưu thông tin địa điểm (`location_info`)
  - Collection lưu tài liệu văn bản (`text_collection`)
  - Collection lưu hình ảnh (`image_collection`)
- **2.7. Thiết kế lưu trữ ảnh trên S3**
- **2.8. Kết quả dữ liệu sau khi chuẩn bị**

---

## CHƯƠNG 3: XÂY DỰNG PIPELINE XỬ LÝ DỮ LIỆU VÀ TÌM KIẾM
- **3.1. Mục tiêu của pipeline xử lý dữ liệu**
- **3.2. Pipeline xử lý dữ liệu văn bản**
  - Tạo text embedding
  - Lưu vector văn bản vào Qdrant
  - Gắn thông tin `location_id` và metadata liên quan
- **3.3. Pipeline xử lý dữ liệu hình ảnh**
  - Tạo image embedding
  - Tạo caption/text vector nếu có
  - Lưu vector ảnh vào Qdrant
  - Liên kết ảnh với địa điểm và đường dẫn S3
- **3.4. Pipeline tìm kiếm tài liệu**
  - Tìm kiếm tài liệu bằng text vector
  - Lọc kết quả theo `location_id` nếu có
- **3.5. Pipeline tìm kiếm hình ảnh**
  - Tìm kiếm ảnh bằng image vector
  - Tìm kiếm ảnh bằng text-to-image vector
  - Tìm kiếm theo caption vector
  - Kết hợp kết quả bằng hybrid search
- **3.6. Pipeline tổng hợp dữ liệu phục vụ trả lời**
  - Gom dữ liệu từ tài liệu, hình ảnh và metadata
  - Chuẩn bị dữ liệu đầu vào cho LLM
  - Hạn chế sinh câu trả lời ngoài dữ liệu truy xuất được

---

## CHƯƠNG 4: PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG
- **4.1. Yêu cầu chức năng**
  - Người dùng hỏi bằng văn bản
  - Người dùng gửi hình ảnh
  - Người dùng gửi cả văn bản và hình ảnh
  - Hệ thống trả lời dựa trên dữ liệu truy xuất được
  - Hệ thống gợi ý câu hỏi tiếp theo nếu có
- **4.2. Yêu cầu phi chức năng**
  - Dễ mở rộng
  - Dễ bảo trì
  - Phản hồi rõ ràng
  - Hạn chế trả lời sai hoặc bịa thông tin
- **4.3. Kiến trúc tổng thể hệ thống**
- **4.4. Thiết kế luồng xử lý request**
- **4.5. Thiết kế response contract**
- **4.6. Thiết kế 3 luồng xử lý chính**
  - `text_only`
  - `image_only`
  - `text_image` / `image_text`
- **4.7. Thiết kế context hội thoại**
- **4.8. Thiết kế xử lý lỗi và các trạng thái phản hồi**
  - `ok`
  - `error`
  - `out_of_scope`
  - `need_clarification`
  - `low_confidence`

---

## CHƯƠNG 5: XÂY DỰNG BACKEND
- **5.1. Vai trò của backend trong hệ thống**
- **5.2. Xây dựng server bằng NodeJS và Express**
- **5.3. Xây dựng endpoint chính POST /api/chat**
- **5.4. Xử lý dữ liệu đầu vào từ frontend**
  - `session_id`
  - `message`
  - `image`
- **5.5. Phân loại input đầu vào**
  - `text_only`
  - `image_only`
  - `image_text`
- **5.6. Xây dựng các pipeline xử lý chính**
  - `TextOnlyPipeline`
  - `ImageOnlyPipeline`
  - `ImageTextPipeline`
- **5.7. Xây dựng các service xử lý nghiệp vụ**
  - `InputRouterService`
  - `TextUnderstandingService`
  - `ImageTextUnderstandingService`
  - `ContextService`
  - `FusionService`
  - `AnswerGenerator`
- **5.8. Xây dựng repository truy xuất dữ liệu**
  - `TextRepository`
  - `ImageRepository`
  - `LocationRepository`
- **5.9. Tích hợp Qdrant vào backend**
- **5.10. Tích hợp embedding model**
  - `BGE-M3`
  - `SigLIP`
- **5.11. Tích hợp Gemini LLM**
- **5.12. Tích hợp S3 để trả về URL hình ảnh**
- **5.13. Cấu trúc response trả về frontend**

---

## CHƯƠNG 6: THIẾT KẾ VÀ XÂY DỰNG FRONTEND
- **6.1. Vai trò của frontend trong hệ thống**
- **6.2. Công nghệ sử dụng: ReactTS và Vite**
- **6.3. Thiết kế giao diện hỏi đáp**
- **6.4. Thiết kế chức năng nhập văn bản**
- **6.5. Thiết kế chức năng tải ảnh lên**
- **6.6. Thiết kế chức năng gửi đồng thời văn bản và ảnh**
- **6.7. Gửi request từ frontend đến backend**
- **6.8. Hiển thị câu trả lời từ hệ thống**
- **6.9. Hiển thị hình ảnh và thông tin địa điểm**
- **6.10. Hiển thị câu hỏi gợi ý nếu có**
- **6.11. Xử lý trạng thái loading, lỗi và phản hồi không đủ tin cậy**

---

## KẾT LUẬN
- **Tổng kết kết quả đạt được**
- **Những phần đã hoàn thành**
- **Những hạn chế còn tồn tại**
- **Định hướng nâng cấp trong tương lai**
