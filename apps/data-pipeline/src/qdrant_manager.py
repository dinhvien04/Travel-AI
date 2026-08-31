from typing import Any, Dict, List, Optional

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
    SparseVectorParams,
    SparseIndexParams,
    Modifier,
    SparseVector,
)


class QdrantManager:
    def __init__(
        self,
        url: str,
        location_collection: str,
        image_collection: str,
        text_collection: str,
    ):
        self.client = QdrantClient(url=url)
        self.location_collection = location_collection
        self.image_collection = image_collection
        self.text_collection = text_collection

    def collection_exists(self, collection_name: str) -> bool:
        try:
            return self.client.collection_exists(collection_name)
        except Exception:
            collections = self.client.get_collections().collections
            return any(c.name == collection_name for c in collections)

    def create_collections(
        self,
        image_vector_size: int,
        caption_vector_size: int,
        text_vector_size: int,
        recreate: bool = False,
    ):
        self._create_location_collection(recreate=recreate)
        self._create_image_collection(
            image_vector_size=image_vector_size,
            caption_vector_size=caption_vector_size,
            recreate=recreate,
        )
        self._create_text_collection(
            text_vector_size=text_vector_size,
            recreate=recreate,
        )

    def _safe_delete(self, collection_name: str):
        if self.collection_exists(collection_name):
            self.client.delete_collection(collection_name=collection_name)
            print(f"Đã xóa collection: {collection_name}")

    def _create_location_collection(self, recreate: bool = False):
        if recreate:
            self._safe_delete(self.location_collection)

        if self.collection_exists(self.location_collection):
            print(f"Collection đã tồn tại: {self.location_collection}")
            return

        # Collection này dùng để lưu payload metadata địa điểm.
        # Không dùng search vector trực tiếp.
        self.client.create_collection(
            collection_name=self.location_collection,
            vectors_config={},
        )
        print(f"Đã tạo collection: {self.location_collection}")

    def _create_image_collection(
        self,
        image_vector_size: int,
        caption_vector_size: int,
        recreate: bool = False,
    ):
        if recreate:
            self._safe_delete(self.image_collection)

        if self.collection_exists(self.image_collection):
            print(f"Collection đã tồn tại: {self.image_collection}")
            return

        self.client.create_collection(
            collection_name=self.image_collection,
            vectors_config={
                "image_vector": VectorParams(
                    size=image_vector_size,
                    distance=Distance.COSINE,
                ),
                "caption_vector": VectorParams(
                    size=caption_vector_size,
                    distance=Distance.COSINE,
                ),
            },
        )
        print(f"Đã tạo collection: {self.image_collection}")

    def _create_text_collection(self, text_vector_size: int, recreate: bool = False):
        if self.collection_exists(self.text_collection):
            if recreate:
                self.client.delete_collection(
                    collection_name=self.text_collection
                )
            else:
                print(f"Collection đã tồn tại: {self.text_collection}")
                return

        self.client.create_collection(
            collection_name=self.text_collection,
            vectors_config={
                "text_vector": VectorParams(
                    size=text_vector_size,
                    distance=Distance.COSINE,
                )
            },
            sparse_vectors_config={
                "text_sparse_vector": SparseVectorParams(
                    index=SparseIndexParams(
                        on_disk=False,
                    ),
                    modifier=Modifier.IDF,
                )
            },
        )

        print(f"Đã tạo collection: {self.text_collection}")

    def point_exists(self, collection_name: str, point_id: str) -> bool:
        points = self.client.retrieve(
            collection_name=collection_name,
            ids=[point_id],
            with_payload=False,
            with_vectors=False,
        )
        return len(points) > 0

    def upsert_locations(self, points: List[PointStruct]):
        if not points:
            return

        self.client.upsert(
            collection_name=self.location_collection,
            points=points,
        )

    def upsert_images(self, points: List[PointStruct]):
        if not points:
            return

        self.client.upsert(
            collection_name=self.image_collection,
            points=points,
        )

    def upsert_text_chunks(self, points: List[PointStruct]):
        if not points:
            return

        self.client.upsert(
            collection_name=self.text_collection,
            points=points,
        )

    def search_images_by_image_vector(self, query_vector: List[float], top_k: int = 5):
        return self.client.query_points(
            collection_name=self.image_collection,
            query=query_vector,
            using="image_vector",
            limit=top_k,
            with_payload=True,
            with_vectors=False,
        ).points

    def search_images_by_caption_vector(self, query_vector: List[float], top_k: int = 5):
        return self.client.query_points(
            collection_name=self.image_collection,
            query=query_vector,
            using="caption_vector",
            limit=top_k,
            with_payload=True,
            with_vectors=False,
        ).points

    def search_text_chunks(self, query_vector: List[float], top_k: int = 5):
        return self.client.query_points(
            collection_name=self.text_collection,
            query=query_vector,
            using="text_vector",
            limit=top_k,
            with_payload=True,
            with_vectors=False,
        ).points

    def search_text_chunks_dense(self, query_vector: List[float], top_k: int = 5):
        return self.client.query_points(
            collection_name=self.text_collection,
            query=query_vector,
            using="text_vector",
            limit=top_k,
            with_payload=True,
            with_vectors=False,
        ).points


    def search_text_chunks_sparse(self, query_sparse_vector: SparseVector, top_k: int = 5):
        return self.client.query_points(
            collection_name=self.text_collection,
            query=query_sparse_vector,
            using="text_sparse_vector",
            limit=top_k,
            with_payload=True,
            with_vectors=False,
        ).points


    def scroll_images_by_location_id(self, location_id: str, limit: int = 10):
        query_filter = Filter(
            must=[
                FieldCondition(
                    key="location_id",
                    match=MatchValue(value=location_id),
                )
            ]
        )

        points, _ = self.client.scroll(
            collection_name=self.image_collection,
            scroll_filter=query_filter,
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )

        return points

    