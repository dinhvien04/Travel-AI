# Travel AI Assistant - Split Spec Index

Bộ tài liệu này được tách từ file spec tổng thành 4 file nhỏ để vibe code rõ ràng hơn.

## File 1

`architecture_1_text_understanding_rewrite_query.json`

Dùng cho luồng:

```txt
Text only + Follow-up text
```

Ví dụ:

```txt
Biển Quy Hòa có gì đẹp?
Ở đó có gì chơi?
Ảnh thứ hai là ở đâu?
Cho tôi xem ảnh Kỳ Co
```

## File 2

`architecture_2_image_only_simple.json`

Dùng cho luồng:

```txt
Image only
```

Ví dụ:

```txt
User chỉ gửi 1 ảnh địa điểm du lịch.
```

Hệ thống sẽ tự tạo câu hỏi mặc định:

```txt
Đây là địa điểm nào và thông tin tổng quan là gì?
```

## File 3

`architecture_3_text_image_specific_question.json`

Dùng cho luồng:

```txt
Text + Image
```

Ví dụ:

```txt
Gửi ảnh + "Ở đây có gì chơi?"
Gửi ảnh Quy Hòa + "Eo Gió có gì?"
Gửi ảnh + "Chỗ này đẹp không?"
```

## File 4

`FRONTEND_ARCHITECTURE.md`

Dùng riêng cho ReactTS frontend.

Nên tách frontend ra file riêng, không viết chung vào 3 file kiến trúc backend, vì frontend chỉ render theo response contract chung và không cần lặp lại trong từng flow.

## Backend đã đổi sang NodeJS MVC

Trong 3 file JSON, backend được định hướng lại thành:

```txt
Node.js + TypeScript
MVC + Service Layer + Repository Pattern + Pipeline Orchestrator
```

Cấu trúc backend đề xuất:

```txt
apps/api/src/
├── server.ts
├── app.ts
├── config/
├── controllers/
├── models/
├── routes/
├── services/
├── pipelines/
├── planners/
├── guards/
├── llm/
├── embeddings/
├── repositories/
├── schemas/
├── utils/
├── middlewares/
└── tests/
```

## Qdrant

Vẫn giữ đúng ý tưởng cũ:

```txt
- Qdrant là external service.
- Project không tạo Docker Qdrant.
- Project không tạo collection.
- Project không insert embedding.
- Backend chỉ search dữ liệu từ collection có sẵn.
```


## Hybrid search ảnh bằng text

Bản hybrid đã được cập nhật vào:

```txt
architecture_1_text_understanding_rewrite_query.json
architecture_3_text_image_specific_question.json
```

Nguyên tắc bắt buộc:

```txt
- Chỉ có 1 collection ảnh: image_embedding.
- Không tạo CAPTION_COLLECTION riêng.
- image_embedding có 2 vector name:
  - image_vector
  - caption_vector
```

Khi `need_images=true` và user tìm ảnh bằng text:

```txt
rewrite_query
    ↓
SigLIP text encoder → search image_embedding.image_vector
BGE-M3 text encoder  → search image_embedding.caption_vector
    ↓
Gộp theo image_id/path
    ↓
final_score = siglip_score * 0.5 + caption_score * 0.5
    ↓
Trả top-k ảnh phù hợp nhất
```

Hàm repository cần có:

```txt
imageRepository.hybridSearchImagesByText({
  queryText,
  siglipTextVector,
  bgeTextVector,
  locationId,
  topK,
  weights
})
```

Flow image only không bắt buộc hybrid search, vì user upload ảnh thì chỉ cần encode ảnh bằng SigLIP image encoder rồi search `image_embedding.image_vector`.
