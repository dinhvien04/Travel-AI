import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional


class CheckpointStore:
    def __init__(self, path: str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.data = self._load()

    def _load(self) -> Dict[str, Any]:
        if not self.path.exists():
            return {}

        with open(self.path, "r", encoding="utf-8") as f:
            return json.load(f)

    def save(self):
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    def make_id(self, bucket: str, key: str) -> str:
        return f"{bucket}/{key}"

    def is_done(
        self,
        bucket: str,
        key: str,
        etag: Optional[str] = None,
        size: Optional[int] = None,
    ) -> bool:
        file_id = self.make_id(bucket, key)

        if file_id not in self.data:
            return False

        item = self.data[file_id]

        if item.get("status") != "indexed":
            return False

        # Nếu file trên S3 đổi nội dung thì etag hoặc size sẽ khác
        if etag is not None and item.get("etag") != etag:
            return False

        if size is not None and item.get("size") != size:
            return False

        return True

    def mark_processing(
        self,
        bucket: str,
        key: str,
        etag: Optional[str] = None,
        size: Optional[int] = None,
        last_modified: Optional[str] = None,
        file_type: Optional[str] = None,
    ):
        file_id = self.make_id(bucket, key)

        self.data[file_id] = {
            "bucket": bucket,
            "key": key,
            "etag": etag,
            "size": size,
            "last_modified": last_modified,
            "file_type": file_type,
            "status": "processing",
            "started_at": datetime.now().isoformat(),
            "finished_at": None,
            "error": None,
        }

        self.save()

    def mark_indexed(
        self,
        bucket: str,
        key: str,
        point_count: int = 0,
    ):
        file_id = self.make_id(bucket, key)

        if file_id not in self.data:
            self.data[file_id] = {
                "bucket": bucket,
                "key": key,
            }

        self.data[file_id]["status"] = "indexed"
        self.data[file_id]["point_count"] = point_count
        self.data[file_id]["finished_at"] = datetime.now().isoformat()
        self.data[file_id]["error"] = None

        self.save()

    def mark_failed(
        self,
        bucket: str,
        key: str,
        error: str,
    ):
        file_id = self.make_id(bucket, key)

        if file_id not in self.data:
            self.data[file_id] = {
                "bucket": bucket,
                "key": key,
            }

        self.data[file_id]["status"] = "failed"
        self.data[file_id]["finished_at"] = datetime.now().isoformat()
        self.data[file_id]["error"] = error

        self.save()