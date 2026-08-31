# Travel AI Assistant (Multimodal RAG)

Hệ thống trợ lý du lịch AI thông minh hỗ trợ hỏi đáp đa phương thức (**Văn bản + Hình ảnh**) về các địa điểm du lịch tại Việt Nam (Quy Nhơn, Kỳ Co, Eo Gió, Hòn Khô...).

---

## 🏛️ Kiến trúc dự án (Monorepo Structure)

```text
Travel-AI/
├── apps/
│   ├── web/                    # [Frontend] ReactTS + Vite (Chat UI)
│   ├── api/                    # [Backend] Node.js Express (Serving / Chat API, RAG, Hybrid Search)
│   └── data-pipeline/          # [Data Ingestion] Python (S3 -> Embedding SigLIP/BGE-M3 -> Qdrant)
│
├── docs/                       # Tài liệu thiết kế, sơ đồ, spec JSON & Word
│   ├── architecture/           # Kiến trúc chi tiết 3 luồng xử lý
│   ├── design/                 # Tài liệu mô tả & sơ đồ
│   └── guides/                 # Hướng dẫn & checklist phát triển
│
├── .gitignore
└── README.md
```

---

## 🚀 Các luồng xử lý chính (Pipelines)

1. **Text-Only Pipeline (`POST /api/chat`)**: Xử lý câu hỏi văn bản, nhận diện follow-up, truy xuất tài liệu/ảnh theo cơ chế Hybrid Search (SigLIP + BGE-M3).
2. **Image-Only Pipeline (`POST /api/chat`)**: Nhận diện địa điểm từ ảnh người dùng upload bằng SigLIP Image Encoder và cung cấp thông tin tổng quan.
3. **Image-Text Pipeline (`POST /api/chat`)**: Kết hợp nhận diện địa điểm từ hình ảnh và phân tích ý định cụ thể trong câu hỏi văn bản (có xử lý conflict địa điểm).

---

## 🛠️ Hướng dẫn cài đặt & Chạy Local

### 1. Khởi động Qdrant Vector DB & Nạp dữ liệu (Data Pipeline)
```bash
cd apps/data-pipeline
docker compose up -d
pip install -r requirements.txt
python main.py --task full
```

### 2. Chạy Backend API (Node.js)
```bash
cd apps/api
npm install
npm run dev
```

### 3. Chạy Frontend Web (React + Vite)
```bash
cd apps/web
npm install
npm run dev
```
