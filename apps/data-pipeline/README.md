# Tourism Embedding Qdrant

Dự án xây dựng pipeline embedding dữ liệu du lịch từ **AWS S3** vào **Qdrant Vector Database** để phục vụ bài toán nhận diện địa điểm du lịch và truy xuất thông tin bằng văn bản/hình ảnh.

---

## 1. Chức năng chính

Dự án hỗ trợ các chức năng:

- Tạo các collection trong Qdrant.
- Lưu thông tin địa điểm từ `locations.json` vào collection `location_info`.
- Đọc ảnh từ S3, sinh caption, tạo embedding ảnh và caption.
- Đọc tài liệu từ S3, tách nội dung thành section/chunk và tạo embedding văn bản.
- Lưu dữ liệu embedding vào Qdrant để phục vụ tìm kiếm ảnh, tìm kiếm văn bản và RAG.
- Hỗ trợ checkpoint để bỏ qua dữ liệu đã index.

---

## 2. Cấu trúc thư mục

```txt
tourism-embedding-qdrant/
├── main.py
├── configs/
│   └── config.yaml
├── src/
|    ├── checkpoint_store.py 
│   ├── s3_loader.py
│   ├── qdrant_manager.py
│   ├── embedding_models.py
│   ├── data_processor.py
│   └── pipelines.py
├── docker-compose.yml
├── requirements.txt
├── .env
└── qdrant_store/
```

### Mô tả nhanh

| Thành phần | Chức năng |
|---|---|
| `main.py` | File chạy chính, nhận tham số `--task` |
| `configs/config.yaml` | Cấu hình S3, Qdrant, model, batch size |
| `src/s3_loader.py` | Đọc ảnh, tài liệu và `locations.json` từ S3 |
| `src/checkpoint_store.py` | Lưu trạng thái checkpoint |
| `src/qdrant_manager.py` | Tạo collection, upsert và search trong Qdrant |
| `src/embedding_models.py` | Load model và tạo embedding cho ảnh/văn bản |
| `src/data_processor.py` | Xử lý dữ liệu, tạo payload, tách chunk |
| `src/pipelines.py` | Chứa pipeline chính: locations, images, docs |
| `docker-compose.yml` | Cấu hình chạy Qdrant bằng Docker |
| `qdrant_store/` | Thư mục lưu dữ liệu Qdrant local |

---

## 3. Chuẩn bị môi trường

### 3.1. Cài thư viện Python

```bash
pip install -r requirements.txt
```

### 3.2. Tạo file `.env`

Tạo file `.env` ở thư mục gốc của project.
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_DEFAULT_REGION=ap-southeast-1

# Qdrant
QDRANT_URL=http://localhost:6333
```

---

## 4. Chạy Qdrant bằng Docker

Khởi động Qdrant:

```bash
docker compose up -d
```

Kiểm tra container:

```bash
docker ps
```

Dừng Qdrant:

```bash
docker compose down
```

bật  / tắt Qdrant:

```bash
docker-compose start
docker-compose stop
```
---

## 5. Cấu hình Qdrant storage

Mặc định dữ liệu Qdrant được lưu tại:

```txt
./qdrant_store
```

Trong `docker-compose.yml`:

```yaml
volumes:
  - ./qdrant_store:/qdrant/storage
```

Nếu muốn lưu sang ổ D trên Windows, sửa thành:

```yaml
volumes:
  - D:/qdrant_store:/qdrant/storage
```

---

## 6. Cấu trúc dữ liệu trên S3

Ví dụ cấu trúc bucket:

```txt
s3://vietnam-tourism/
├── locations.json
├── BIEN_QUY_HOA/
│   ├── image/
│   │   ├── image_001.jpg
│   │   └── image_002.jpg
│   └── docx/
│       └── overview.docx
├── HON_KHO/
│   ├── image/
│   └── docx/
└── KY_CO/
    ├── image/
    └── docx/
```

Trong đó:

- Folder đầu tiên là `location_key`, ví dụ: `HON_KHO`, `KY_CO`, `BIEN_QUY_HOA`.
- `image/` chứa ảnh địa điểm.
- `docx/` chứa tài liệu mô tả địa điểm.
- `locations.json` chứa metadata địa điểm như `location_id`, `location_key`, `location_name`, `province`, `tags`.

---

## 7. Các collection trong Qdrant

Dự án sử dụng 3 collection chính:

| Collection | Mục đích |
|---|---|
| `location_info` | Lưu thông tin địa điểm từ `locations.json` |
| `image_collection` | Lưu vector ảnh và vector caption |
| `text_collection` | Lưu vector văn bản từ tài liệu du lịch |

### 7.1. `image_collection`

Lưu 2 loại vector:

| Vector | Ý nghĩa |
|---|---|
| `image_vector` | Vector ảnh được tạo từ model SigLIP |
| `caption_vector` | Vector caption/mô tả ảnh được tạo từ model BGE-M3 |

### 7.2. `text_collection`

Lưu vector văn bản từ tài liệu:

| Vector | Ý nghĩa |
|---|---|
| `text_vector` | Dense vector, dùng để tìm kiếm theo ngữ nghĩa |
| `text_sparse_vector` | Sparse vector, dùng để tìm kiếm theo từ khóa |

---

## 8. Lệnh chạy project

### 8.1. Tạo collection

```bash
py main.py --task create-collections
```

Lệnh này tạo các collection:

- `location_info`
- `image_collection`
- `text_collection`

### 8.2. Lưu thông tin địa điểm

```bash
py main.py --task locations
```

Lệnh này đọc `locations.json` từ S3 và lưu vào collection `location_info`.

### 8.3. Embedding ảnh và caption

```bash
py main.py --task images
```

Pipeline ảnh:

```txt
Đọc ảnh từ S3
→ Sinh caption tiếng Anh
→ Dịch caption sang tiếng Việt
→ Tạo image_vector bằng SigLIP
→ Tạo caption_vector bằng BGE-M3
→ Lưu vào image_collection
```

### 8.4. Embedding tài liệu

```bash
py main.py --task docs
```

Pipeline tài liệu:

```txt
Đọc tài liệu từ S3
→ Parse nội dung
→ Tách section/chunk
→ Tạo dense vector
→ Tạo sparse vector
→ Lưu vào text_collection
```

### 8.5. Chạy toàn bộ pipeline

```bash
py main.py --task full
```

Lệnh này chạy lần lượt:

```txt
create-collections
→ locations
→ images
→ docs
```

---

## 9. Checkpoint

Dự án có thể dùng checkpoint để tránh xử lý lại dữ liệu đã index.

Ví dụ:

```txt
logs/checkpoint_images.json
logs/checkpoint_docs.json
```

Cơ chế hoạt động:

```txt
Ảnh/tài liệu đã index xong
→ status = indexed
→ lần sau chạy lại sẽ bỏ qua

Ảnh/tài liệu đang xử lý dở
→ status = processing
→ lần sau chạy lại sẽ xử lý lại

Ảnh/tài liệu lỗi
→ status = failed
→ lần sau có thể xử lý lại
```

Điều này giúp pipeline có thể tiếp tục chạy khi bị tắt đột ngột hoặc khi S3 có thêm file mới.

---

## 10. Ghi chú khi chạy

Nếu thay đổi schema collection, nên xóa collection cũ trước khi tạo lại.

Ví dụ xóa `text_collection`:

```powershell
Invoke-RestMethod -Method Delete http://localhost:6333/collections/text_collection
```

Sau đó tạo lại collection:

```bash
py main.py --task create-collections
```

Nếu Qdrant báo lỗi storage hoặc thiếu dung lượng, kiểm tra Docker:

```bash
docker system df
```

Dọn dữ liệu Docker không dùng:

```bash
docker system prune
```

---

## 11. Tóm tắt quy trình chạy lần đầu

```bash
docker compose up -d
pip install -r requirements.txt

py main.py --task create-collections
py main.py --task locations
py main.py --task images
py main.py --task docs
```

Hoặc chạy toàn bộ:

```bash
py main.py --task full
```
