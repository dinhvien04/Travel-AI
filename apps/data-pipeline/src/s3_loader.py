import json
import os
from io import BytesIO
from typing import Any, Dict, List
import boto3  # type: ignore[import-not-found]
from PIL import Image


IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")
DOC_EXTENSIONS = (".docx", ".txt", ".pdf")


def get_s3_client():
    return boto3.client(
        "s3",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=os.getenv("AWS_REGION"),
    )

def read_json_from_s3(s3_client, bucket: str, key: str) -> Any:
    obj = s3_client.get_object(Bucket=bucket, Key=key)
    content = obj["Body"].read().decode("utf-8")
    return json.loads(content)


def read_image_from_s3(s3_client, bucket: str, key: str) -> Image.Image:
    obj = s3_client.get_object(Bucket=bucket, Key=key)
    image_bytes = obj["Body"].read()
    return Image.open(BytesIO(image_bytes)).convert("RGB")


def read_bytes_from_s3(s3_client, bucket: str, key: str) -> bytes:
    obj = s3_client.get_object(Bucket=bucket, Key=key)
    return obj["Body"].read()


def make_s3_uri(bucket: str, key: str) -> str:
    return f"s3://{bucket}/{key}"

# docs
def list_doc_objects(s3_client, bucket: str, doc_folder_name: str = "docx"):
    doc_objects = []
    paginator = s3_client.get_paginator("list_objects_v2")

    for page in paginator.paginate(Bucket=bucket):
        for item in page.get("Contents", []):
            key = item["Key"]
            parts = key.split("/")

            if len(parts) >= 3 and parts[1].lower() == doc_folder_name.lower():
                if key.lower().endswith((".docx", ".pdf", ".txt", ".md")):
                    doc_objects.append({
                        "key": key,
                        "etag": item.get("ETag"),
                        "size": item.get("Size"),
                        "last_modified": item.get("LastModified").isoformat()
                        if item.get("LastModified") else None,
                    })

    return doc_objects


# images
def list_image_objects(s3_client, bucket: str, image_folder_name: str = "image"):
    image_objects = []
    paginator = s3_client.get_paginator("list_objects_v2")

    for page in paginator.paginate(Bucket=bucket):
        for item in page.get("Contents", []):
            key = item["Key"]
            parts = key.split("/")

            if len(parts) >= 3 and parts[1].lower() == image_folder_name.lower():
                if key.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                    image_objects.append({
                        "key": key,
                        "etag": item.get("ETag"),
                        "size": item.get("Size"),
                        "last_modified": item.get("LastModified").isoformat()
                        if item.get("LastModified") else None,
                    })

    return image_objects