# Travel AI Assistant API

Backend NodeJS + Express thuan JavaScript theo huong MVC + Service + Repository + Pipeline.

## Cau truc

```text
apps/api/
├── src/
│   ├── app.js
│   ├── server.js
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
│   ├── utils/
│   └── tests/
├── package.json
├── .env.example
└── README.md
```

## Endpoint test

```http
GET /api/health
```

## Chay local

```bash
cd apps/api
npm install
npm run dev
```

Kiem tra:

```bash
curl http://localhost:8000/api/health
```

## Embedding models

Backend dang dung embedding model that qua `@huggingface/transformers`:

- Text docs/caption: `onnx-community/bge-m3-ONNX` (ONNX export cua `BAAI/bge-m3`)
- Image/text-to-image: `Xenova/siglip-base-patch16-384` (ONNX export cua `google/siglip-base-patch16-384`)

Lan chay dau tien se tai model tu Hugging Face ve cache nen co the cham va can internet.

Bien moi trong `.env`:

```env
GEMINI_API_KEYS=Key1,Key2,Key3
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

BGE_M3_MODEL=onnx-community/bge-m3-ONNX
SIGLIP_MODEL=Xenova/siglip-base-patch16-384
BGE_M3_VECTOR_DIM=1024
SIGLIP_IMAGE_VECTOR_DIM=768
SIGLIP_TEXT_VECTOR_DIM=768
EMBEDDING_NORMALIZE=true
TRANSFORMERS_DEVICE=cpu
TRANSFORMERS_DTYPE=
TRANSFORMERS_CACHE_DIR=./.cache/transformers
```

Neu lan dau chay gap loi thieu `model.onnx_data`, hay dung server va xoa cache model dang tai do:

```powershell
Remove-Item -Recurse -Force .\.cache\transformers\onnx-community\bge-m3-ONNX
```

Sau do chay lai `npm run dev`. BGE-M3 la ONNX model lon nen can tai ca `model.onnx` va `model.onnx_data`.

## Ghi chu

- Qdrant search dung external Qdrant, backend khong tao collection.
- Gemini LLM uu tien `GEMINI_API_KEYS=Key1,Key2,Key3`; neu gap quota/rate-limit thi thu key tiep theo. `GEMINI_API_KEY` van duoc giu de tuong thich cau hinh 1 key.
- Embedding dung model that, khong con deterministic mock vector.
- Dev server dung nodemon va chay truc tiep tu `src/server.js`.
