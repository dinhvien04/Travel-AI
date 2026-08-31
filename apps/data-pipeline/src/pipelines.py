import os
from typing import Any, Dict, List
import yaml
from dotenv import load_dotenv
from qdrant_client.models import PointStruct
from src.checkpoint_store import CheckpointStore
from src.s3_loader import list_doc_objects, list_image_objects
import src.data_processor as data_processor
from src.embedding_models import EmbeddingModels
from src.qdrant_manager import QdrantManager
import src.s3_loader as s3_loader


def _expand_env(value: Any) -> Any:
    if isinstance(value, str):
        for key, env_value in os.environ.items():
            value = value.replace("${" + key + "}", env_value)
    return value


def load_config(path: str = "configs/config.yaml") -> Dict[str, Any]:
    load_dotenv()

    with open(path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    def walk(obj):
        if isinstance(obj, dict):
            return {k: walk(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [walk(v) for v in obj]
        return _expand_env(obj)

    return walk(config)


def build_qdrant_manager(config: Dict[str, Any]) -> QdrantManager:
    return QdrantManager(
        url=config["qdrant"]["url"],
        location_collection=config["collections"]["location_info"],
        image_collection=config["collections"]["image_collection"],
        text_collection=config["collections"]["text_collection"],
    )


def build_models(config: Dict[str, Any]) -> EmbeddingModels:
    model_cfg = config["models"]

    return EmbeddingModels(
        siglip_model_name=model_cfg["siglip"],
        florence_model_name=model_cfg["florence"],
        bge_model_name=model_cfg["bge"],
        translator_model_name=model_cfg.get("translator"),
        use_translator=bool(model_cfg.get("use_translator", True)),
    )


def load_locations(config):
    s3_client = s3_loader.get_s3_client()

    bucket = config["s3"]["bucket"]
    locations_key = config["s3"]["locations_key"]

    raw_locations = s3_loader.read_json_from_s3(
        s3_client=s3_client,
        bucket=bucket,
        key=locations_key
    )

    return data_processor.normalize_locations(raw_locations)



def run_create_collections(recreate: bool = False):
    config = load_config()
    qdrant = build_qdrant_manager(config)
    models = build_models(config)

    siglip_dim = models.get_siglip_dim()
    bge_dim = models.get_bge_dim()

    qdrant.create_collections(
        image_vector_size=siglip_dim,
        caption_vector_size=bge_dim,
        text_vector_size=bge_dim,
        recreate=recreate,
    )


def run_location_pipeline():
    config = load_config()
    qdrant = build_qdrant_manager(config)

    locations = load_locations(config)

    points = []
    for location_key, payload in locations.items():
        location_id = payload.get("location_id") or location_key
        point_id = data_processor.make_point_id("location", location_id)

        points.append(
            PointStruct(
                id=point_id,
                vector={},
                payload=payload,
            )
        )

    qdrant.upsert_locations(points)
    print(f"Đã upsert {len(points)} địa điểm vào collection location_info.")


def run_image_pipeline():
    config = load_config()
    s3_client = s3_loader.get_s3_client()
    qdrant = build_qdrant_manager(config)
    models = build_models(config)

    bucket = config["s3"]["bucket"]
    batch_size = int(config["pipeline"].get("batch_size", 4))
    locations = load_locations(config)
    checkpoint = CheckpointStore(path="logs/checkpoint_images.json")
    image_objects = list_image_objects(
        s3_client=s3_client,
        bucket=bucket,
        image_folder_name=config["s3"].get("image_folder_name", "image")
    )

    print(f"Tổng số ảnh tìm thấy trên S3: {len(image_objects)}")

    new_image_objects = []

    for image_obj in image_objects:
        key = image_obj["key"]
        etag = image_obj.get("etag")
        size = image_obj.get("size")

        if checkpoint.is_done(
            bucket=bucket,
            key=key,
            etag=etag,
            size=size,
        ):
            print(f"Bỏ qua ảnh đã index: {key}")
            continue

        new_image_objects.append(image_obj)

    print(f"Số ảnh mới cần index: {len(new_image_objects)}")

    total = len(new_image_objects)
    total_indexed = 0

    for start in range(0, total, batch_size):
        batch_objects = new_image_objects[start:start + batch_size]

        prepared_items = []

        for image_obj in batch_objects:
            key = image_obj["key"]
            etag = image_obj.get("etag")
            size = image_obj.get("size")
            last_modified = image_obj.get("last_modified")

            checkpoint.mark_processing(
                bucket=bucket,
                key=key,
                etag=etag,
                size=size,
                last_modified=last_modified,
                file_type="image",
            )

            try:
                image = s3_loader.read_image_from_s3(
                    s3_client=s3_client,
                    bucket=bucket,
                    key=key,
                )

                caption_en = models.generate_caption(
                    image,
                    detailed=True
                )

                caption_vi = models.translate_en_to_vi(
                    caption_en
                )

                location = data_processor.get_location_metadata(
                    s3_key=key,
                    locations=locations,
                )

                embedding_text = data_processor.build_caption_embedding_text(
                    caption_vi=caption_vi,
                    location=location,
                )

                payload = data_processor.build_image_payload(
                    bucket=bucket,
                    s3_key=key,
                    location=location,
                    caption_en=caption_en,
                    caption_vi=caption_vi,
                    embedding_text=embedding_text,
                )

                prepared_items.append({
                    "key": key,
                    "image": image,
                    "caption_en": caption_en,
                    "caption_vi": caption_vi,
                    "embedding_text": embedding_text,
                    "payload": payload,
                })

            except Exception as e:
                checkpoint.mark_failed(
                    bucket=bucket,
                    key=key,
                    error=str(e),
                )

                print(f"Lỗi khi đọc/caption ảnh: {key}")
                print(e)

        if not prepared_items:
            continue

        try:
            images = [
                item["image"]
                for item in prepared_items
            ]

            caption_texts = [
                item["embedding_text"]
                for item in prepared_items
            ]

            image_vectors = models.encode_images_batch(
                images
            )

            caption_vectors = models.encode_texts_bge(
                caption_texts,
                batch_size=batch_size
            )

            points = []

            for item, image_vector, caption_vector in zip(
                prepared_items,
                image_vectors,
                caption_vectors,
            ):
                key = item["key"]
                payload = item["payload"]

                point_id = data_processor.make_point_id(
                    "image",
                    f"s3://{bucket}/{key}"
                )

                points.append(
                    PointStruct(
                        id=point_id,
                        vector={
                            "image_vector": image_vector,
                            "caption_vector": caption_vector,
                        },
                        payload={
                            **payload,
                            "modality": "image",
                        },
                    )
                )

            qdrant.upsert_images(points)

            for item in prepared_items:
                key = item["key"]

                checkpoint.mark_indexed(
                    bucket=bucket,
                    key=key,
                    point_count=1,
                )

            total_indexed += len(points)

            print(f"Đã index {total_indexed}/{total} ảnh mới.")

        except Exception as e:
            for item in prepared_items:
                key = item["key"]

                checkpoint.mark_failed(
                    bucket=bucket,
                    key=key,
                    error=str(e),
                )

            print("Lỗi khi embedding/upsert batch ảnh")
            print(e)

    print(f"Hoàn tất index ảnh + caption vào Qdrant. Tổng ảnh mới đã index: {total_indexed}")


def run_text_pipeline():
    config = load_config()
    s3_client = s3_loader.get_s3_client()
    qdrant = build_qdrant_manager(config)
    models = build_models(config)

    bucket = config["s3"]["bucket"]

    max_chars = int(config["chunking"].get("chunk_size", 1200))
    overlap = int(config["chunking"].get("chunk_overlap", 200))
    batch_size = int(config["pipeline"].get("batch_size", 4))

    locations = s3_loader.load_locations(config)

    checkpoint = CheckpointStore(
        path="logs/checkpoint_docs.json"
    )

    doc_objects = s3_loader.list_doc_objects(
        s3_client=s3_client,
        bucket=bucket,
        doc_folder_name=config["s3"].get("doc_folder_name", "docx")
    )

    print(f"Tổng số tài liệu tìm thấy trên S3: {len(doc_objects)}")

    total_points = 0

    for doc_obj in doc_objects:
        doc_key = doc_obj["key"]
        etag = doc_obj.get("etag")
        size = doc_obj.get("size")
        last_modified = doc_obj.get("last_modified")

        if checkpoint.is_done(
            bucket=bucket,
            key=doc_key,
            etag=etag,
            size=size,
        ):
            print(f"Bỏ qua file đã index: {doc_key}")
            continue

        checkpoint.mark_processing(
            bucket=bucket,
            key=doc_key,
            etag=etag,
            size=size,
            last_modified=last_modified,
            file_type="doc",
        )

        try:
            file_bytes = s3_loader.read_bytes_from_s3(
                s3_client=s3_client,
                bucket=bucket,
                key=doc_key
            )

            text = data_processor.parse_document_bytes(
                file_bytes=file_bytes,
                file_name=doc_key
            )

            if not text.strip():
                print(f"Bỏ qua file rỗng hoặc không đọc được nội dung: {doc_key}")

                checkpoint.mark_failed(
                    bucket=bucket,
                    key=doc_key,
                    error="File rỗng hoặc không đọc được nội dung",
                )

                continue

            location = data_processor.get_location_metadata(
                s3_key=doc_key,
                locations=locations,
            )

            location_id = location.get("location_id")

            if not location_id:
                print(f"Bỏ qua file vì không xác định được location_id: {doc_key}")

                checkpoint.mark_failed(
                    bucket=bucket,
                    key=doc_key,
                    error="Không xác định được location_id",
                )

                continue

            document_type = data_processor.infer_document_type(doc_key)
            source_file = os.path.basename(doc_key)

            chunks = data_processor.build_document_chunks(
                text=text,
                location_id=location_id,
                document_type=document_type,
                max_chars=max_chars,
                overlap=overlap
            )

            if not chunks:
                print(f"Không tạo được chunk từ file: {doc_key}")

                checkpoint.mark_failed(
                    bucket=bucket,
                    key=doc_key,
                    error="Không tạo được chunk",
                )

                continue

            embedding_texts = [
                data_processor.build_text_embedding_text(
                    chunk_content=chunk["content"],
                    location=location,
                    document_type=document_type,
                    section_title=chunk["section_title"]
                )
                for chunk in chunks
            ]

            file_point_count = 0

            for start in range(0, len(embedding_texts), batch_size):
                batch_texts = embedding_texts[start:start + batch_size]
                batch_chunks = chunks[start:start + batch_size]

                dense_vectors = models.encode_texts_bge(
                    batch_texts,
                    batch_size=batch_size
                )

                sparse_vectors = models.encode_texts_sparse(
                    batch_texts
                )

                points = []

                for chunk, embedding_text, dense_vector, sparse_vector in zip(
                    batch_chunks,
                    batch_texts,
                    dense_vectors,
                    sparse_vectors,
                ):
                    payload = data_processor.build_text_payload(
                        chunk=chunk,
                        location=location,
                        document_type=document_type,
                        source_file=source_file,
                        bucket=bucket,
                        s3_key=doc_key,
                        embedding_text=embedding_text,
                    )

                    point_id = data_processor.make_point_id(
                        "chunk",
                        f"s3://{bucket}/{doc_key}:{chunk['chunk_id']}"
                    )

                    points.append(
                        PointStruct(
                            id=point_id,
                            vector={
                                "text_vector": dense_vector,
                                "text_sparse_vector": sparse_vector,
                            },
                            payload=payload,
                        )
                    )

                qdrant.upsert_text_chunks(points)

                file_point_count += len(points)
                total_points += len(points)

            print(f"Đã index {file_point_count} chunks từ file: {doc_key}")

            checkpoint.mark_indexed(
                bucket=bucket,
                key=doc_key,
                point_count=file_point_count,
            )

        except Exception as e:
            checkpoint.mark_failed(
                bucket=bucket,
                key=doc_key,
                error=str(e),
            )

            print(f"Lỗi khi xử lý file: {doc_key}")
            print(e)

    print(f"Hoàn tất index tài liệu. Tổng số chunk: {total_points}")


def run_full_pipeline():
    run_create_collections(recreate=False)
    run_location_pipeline()
    run_image_pipeline()
    run_text_pipeline()
