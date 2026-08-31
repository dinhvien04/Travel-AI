import os
import uuid
from io import BytesIO
from typing import Any, Dict, List
import re
from docx import Document
from pypdf import PdfReader

# tạo id cố định cho point Qdrant bằng UUID, đảm bảo cùng một location_key sẽ có cùng một point_id
def make_point_id(prefix: str, value: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{prefix}:{value}"))

def normalize_location_key(value: str) -> str:
    return value.strip().upper()


# Chuẩn hóa dữ liều file locations.json về cùng dict theo location_key
def normalize_locations(raw_locations):
    locations = {}

    if isinstance(raw_locations, list):
        for item in raw_locations:
            location_key = item.get("location_key")

            if not location_key:
                continue

            location_key = location_key.strip()

            normalized_key = normalize_location_key(location_key)
            locations[normalized_key] = item

    elif isinstance(raw_locations, dict):
        for key, item in raw_locations.items():
            if not isinstance(item, dict):
                continue

            location_key = item.get("location_key", key).strip()
            item["location_key"] = location_key

            normalized_key = normalize_location_key(location_key)
            locations[normalized_key] = item

    return locations


def get_location_key_from_s3_key(s3_key: str) -> str:
    """
    Ví dụ:
    BIEN_QUY_HOA/docx/overview.docx -> BIEN_QUY_HOA
    HON_KHO/image/001.jpg -> HON_KHO
    """

    parts = s3_key.split("/")

    if len(parts) >= 1:
        return parts[0].strip()

    return ""


def get_location_metadata(s3_key: str, locations: dict):
    """
    Lấy metadata địa điểm từ locations.json.
    """
    location_key = get_location_key_from_s3_key(s3_key)

    location = (
        locations.get(location_key)
        or locations.get(location_key.upper())
        or locations.get(location_key.lower())
    )

    if not location:
        print(f"Không tìm thấy metadata cho location_key: {location_key}")

        return {
            "location_id": None,
            "location_key": location_key,
            "location_name": location_key,
            "province": "",
            "description": "",
            "tags": []
        }

    return location

# ghép caption và metadata để tạo embedding text cho ảnh
def build_caption_embedding_text(caption_vi: str, location: Dict[str, Any]) -> str:
    tags = location.get("tags", [])
    tags_text = ", ".join(tags) if isinstance(tags, list) else str(tags)

    return f"""
        Địa điểm: {location.get("location_name", "")},
        Tỉnh/Thành phố: {location.get("province", "")},
        Mô tả địa điểm: {location.get("description", "")},
        Thẻ mô tả: {tags_text},
        Mô tả ảnh: {caption_vi}
        """.strip()

# ghép nội dung văn bản và metadata để tạo embedding text cho tài liệu
def build_text_embedding_text(
    chunk_content: str,
    location: Dict[str, Any],
    document_type: str,
    section_title: str
) -> str:
    """
    Tạo text đầu vào cho BGE-M3 embedding.
    """

    tags = location.get("tags", [])

    if isinstance(tags, list):
        tags = ", ".join(tags)

    embedding_text = f"""
        Địa điểm: {location.get("location_name", "")}
        Tỉnh/Thành phố: {location.get("province", "")}, 
        Loại tài liệu: {document_type}, 
        Tiêu đề nội dung: {section_title},
        Mô tả địa điểm: {location.get("description", "")},
        Tags: {tags},
        Nội dung: {chunk_content}
        """.strip()

    return embedding_text

# build payload cho ảnh trước khi lưu vào collection Qdrant
def build_image_payload(
    bucket: str,
    s3_key: str,
    location: Dict[str, Any],
    caption_en: str,
    caption_vi: str,
    embedding_text: str,
) -> Dict[str, Any]:
   
    file_name = os.path.basename(s3_key)
    image_name = os.path.splitext(file_name)[0]

    location_id = location.get("location_id")
    location_key = location.get("location_key")

    # Tạo image_id có kèm location_id để tránh trùng tên ảnh giữa các địa điểm
    if location_id:
        image_id = f"{location_id}_{image_name}"
    else:
        image_id = image_name

    s3_path = f"{bucket}/{s3_key}"

    return {
        "image_id": image_id,
        "file_name": file_name,
        "s3_path": s3_path,
        # metadata địa điểm
        "location_id": location_id,
        "location_key": location_key,
        "location_name": location.get("location_name"),
        "caption_en": caption_en,
        "caption_vi": caption_vi,
        "embedding_text": embedding_text,
    }

# BUILD COLLECTION CHO TÀI LIỆU VĂN BẢN
# 1. Đọc nội dung văn bản từ file bytes
def parse_document_bytes(file_bytes: bytes, file_name: str) -> str:
    lower = file_name.lower()

    if lower.endswith(".docx"):
        document = Document(BytesIO(file_bytes))
        paragraphs = [
            p.text.strip()
            for p in document.paragraphs
            if p.text and p.text.strip()
        ]
        return "\n".join(paragraphs)

    if lower.endswith(".pdf"):
        reader = PdfReader(BytesIO(file_bytes))
        texts = []

        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                texts.append(page_text.strip())

        return "\n".join(texts)

    if lower.endswith((".txt", ".md")):
        return file_bytes.decode("utf-8", errors="ignore")

    return ""



# 2. Tạo document_type từ tên file
def infer_document_type(s3_key: str) -> str:
    file_name = os.path.basename(s3_key)
    name_without_ext = os.path.splitext(file_name)[0]
    return name_without_ext.lower().strip()

# 3. Chuẩn hóa text trước khi chunk
def normalize_text(text: str) -> str:
    """
    Chuẩn hóa văn bản, bỏ khoảng trắng dư nhưng vẫn giữ xuống dòng.
    """
    lines = []
    for line in text.splitlines():
        clean_line = " ".join(line.strip().split())
        if clean_line:
            lines.append(clean_line)

    return "\n".join(lines)


# 4. Tạo section_id và chunk_id
def build_section_id(
    location_id: str,
    document_type: str,
    section_number: str
) -> str:
    """
    Tạo ID chung cho một tiêu đề/section.
    Các chunk nhỏ thuộc cùng tiêu đề sẽ dùng chung section_id.
    """

    section_number = str(section_number).zfill(3)
    return f"{location_id}_{document_type}_{section_number}"


def build_chunk_id(
    section_id: str,
    chunk_index: int
) -> str:
    """
    Tạo ID riêng cho từng chunk nhỏ trong một section.
    """

    return f"{section_id}_part_{str(chunk_index).zfill(3)}"


# 5. Tách văn bản theo tiêu đề
def split_text_by_headings(text: str) -> List[Dict[str, Any]]:
    
    text = normalize_text(text) # giữ nguyên xuống dòng để phân biệt đoạn văn, loại bỏ khoảng trắng thừa
    lines = text.splitlines()

    #  - ^\s* : bắt đầu dòng, (\d+) : nhóm số thứ tự của tiêu đề, [\.\)] : dấu chấm hoặc dấu đóng ngoặc sau số thứ tự, \s* : có thể có khoảng trắng sau đó, (.+) : nhóm tiêu đề, $ : kết thúc dòng
    heading_pattern = re.compile(
        r"^\s*(\d+)[\.\)]\s*(.+)$",
        re.MULTILINE
    )

    sections = []
    current_section = None
    # strip() để loại bỏ khoảng trắng ở đầu và cuối dòng
    for line in lines:
        line = line.strip()
        if not line:
            continue

        match = heading_pattern.match(line)

        is_heading = False

        if match:
            section_number = match.group(1).strip()
            section_title = match.group(2).strip()

            # Tránh nhận nhầm câu văn thường thành heading
            if len(section_title) <= 120 and not section_title.endswith((".", ":", ";", ",")):
                is_heading = True

        if is_heading:
            if current_section and current_section["content"].strip():
                sections.append(current_section)

            current_section = {
                "section_number": section_number,
                "section_title": section_title,
                "content": ""
            }
        else:
            if current_section is None:
                current_section = {
                    "section_number": "1",
                    "section_title": "Nội dung chính",
                    "content": ""
                }

            current_section["content"] += line + "\n"

    if current_section and current_section["content"].strip():
        sections.append(current_section)

    return sections


# 6. Chunk text theo độ dài nếu section quá dài
def chunk_text(
    text: str,
    chunk_size: int = 1200,
    chunk_overlap: int = 200
) -> List[str]:
    """
    Chia text thành nhiều chunk nhưng ưu tiên cắt theo câu/đoạn,
    hạn chế cắt giữa chữ.
    """

    text = " ".join(text.split())

    if not text:
        return []

    if chunk_overlap >= chunk_size:
        raise ValueError("chunk_overlap phải nhỏ hơn chunk_size")

    chunks = []
    start = 0
    text_len = len(text)

    while start < text_len:
        end = min(start + chunk_size, text_len)

        if end < text_len:
            # Ưu tiên cắt ở dấu câu gần cuối chunk
            cut_positions = [
                text.rfind(".", start, end),
                text.rfind("!", start, end),
                text.rfind("?", start, end),
                text.rfind(";", start, end),
                text.rfind(",", start, end),
                text.rfind(" ", start, end),
            ]

            best_cut = max(cut_positions)

            if best_cut > start + int(chunk_size * 0.6):
                end = best_cut + 1

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= text_len:
            break

        start = max(0, end - chunk_overlap)

        # Đẩy start tới khoảng trắng tiếp theo để tránh bắt đầu giữa chữ
        while start < text_len and text[start] not in (" ", "\n"):
            start += 1

    return chunks

# 7. Build document chunks theo section_id
def build_document_chunks(
    text: str,
    location_id: str,
    document_type: str,
    max_chars: int = 1200,
    overlap: int = 200
) -> List[Dict[str, Any]]:
    """
    Mỗi tiêu đề trong file sẽ trở thành 1 chunk duy nhất.
    Không chia nhỏ theo max_chars nữa.

    Ví dụ:
    1. Giới thiệu địa điểm -> 1 chunk
    2. Mô tả tổng quan      -> 1 chunk
    3. Giá vé tham quan     -> 1 chunk
    """

    sections = split_text_by_headings(text)
    final_chunks: List[Dict[str, Any]] = []

    for section in sections:
        section_number = str(section.get("section_number", "1"))
        section_title = section.get("section_title", "Nội dung chính")
        content = section.get("content", "").strip()

        if not content:
            continue

        section_id = build_section_id(
            location_id=location_id,
            document_type=document_type,
            section_number=section_number
        )

        chunk_id = build_chunk_id(
            section_id=section_id,
            chunk_index=1
        )

        final_chunks.append({
            "section_id": section_id,
            "chunk_id": chunk_id,
            "section_number": section_number,
            "section_title": section_title,
            "chunk_index": 1,
            "total_chunks": 1,
            "content": content
        })

    return final_chunks

# 8. Build payload cho text_collection Qdrant
def build_text_payload(
    chunk: Dict[str, Any],
    location: Dict[str, Any],
    document_type: str,
    source_file: str,
    bucket: str,
    s3_key: str,
    embedding_text: str,
) -> Dict[str, Any]:
    s3_path = f"{bucket}/{s3_key}"
    payload = {
        "chunk_id": chunk["chunk_id"],
        "section_id": chunk["section_id"],

        "location_id": location.get("location_id"),
        "location_key": location.get("location_key"),

        "document_type": document_type,
        "source_file": source_file,
        "s3_path": s3_path,

        "section_number": chunk["section_number"],
        "section_title": chunk["section_title"],
        "chunk_index": chunk["chunk_index"],
        "total_chunks": chunk["total_chunks"],

        "content": chunk["content"],
        "embedding_text": embedding_text,
    }

    return payload
