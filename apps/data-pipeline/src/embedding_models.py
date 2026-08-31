from typing import List
from fastembed import SparseTextEmbedding
from qdrant_client.models import SparseVector
import torch 
import torch.nn.functional as F
from PIL import Image # read and process image
from sentence_transformers import SentenceTransformer # model BGE-M3
from transformers import (
    AutoModel,
    AutoModelForCausalLM,
    AutoModelForSeq2SeqLM,
    AutoProcessor,
    AutoTokenizer,
)


class EmbeddingModels:
    def __init__(
        self,
        siglip_model_name: str,
        florence_model_name: str,
        bge_model_name: str,
        translator_model_name: str | None = None,
        use_translator: bool = True,
    ):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print("Device:", self.device)

        print("Đang load SigLIP...")
        self.siglip_processor = AutoProcessor.from_pretrained(siglip_model_name)
        self.siglip_model = AutoModel.from_pretrained(siglip_model_name).to(self.device)
        self.siglip_model.eval()

        print("Đang load Florence-2...")
        self.florence_processor = AutoProcessor.from_pretrained(
            florence_model_name,
            trust_remote_code=True,
        )
        self.florence_model = AutoModelForCausalLM.from_pretrained(
            florence_model_name,
            trust_remote_code=True,
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
            attn_implementation="eager",
        ).to(self.device)
        self.florence_model.eval()

        print("Đang load BGE-M3...")
        self.bge_model = SentenceTransformer(bge_model_name, device=self.device)

        self.use_translator = use_translator and bool(translator_model_name)
        self.translate_tokenizer = None
        self.translate_model = None

        if self.use_translator:
            print("Đang load model dịch EN -> VI...")
            self.translate_tokenizer = AutoTokenizer.from_pretrained(translator_model_name)
            self.translate_model = AutoModelForSeq2SeqLM.from_pretrained(
                translator_model_name
            ).to(self.device)
            self.translate_model.eval()
        
        print("Đang load model sparse embedding...")
        self.sparse_model = SparseTextEmbedding(
            model_name="Qdrant/bm25"
        )
        print("Load model xong.")

    def encode_images_batch(self, images: List[Image.Image]) -> List[List[float]]:
        inputs = self.siglip_processor(
            images=images,
            return_tensors="pt",
            padding=True,
        ).to(self.device)

        with torch.no_grad():
            image_features = self.siglip_model.get_image_features(**inputs)

        image_features = F.normalize(image_features, p=2, dim=-1)
        return image_features.cpu().numpy().tolist()

    def encode_text_siglip(self, text: str) -> List[float]:
        inputs = self.siglip_processor(
            text=[text],
            padding=True,
            truncation=True,
            return_tensors="pt",
        ).to(self.device)

        with torch.no_grad():
            text_features = self.siglip_model.get_text_features(**inputs)

        text_features = F.normalize(text_features, p=2, dim=-1)
        return text_features.cpu().numpy()[0].tolist()

    def generate_caption(self, image: Image.Image, detailed: bool = True) -> str:
        task_prompt = "<MORE_DETAILED_CAPTION>" if detailed else "<CAPTION>"

        inputs = self.florence_processor(
            text=task_prompt,
            images=image,
            return_tensors="pt",
        ).to(self.device)

        with torch.no_grad():
            generated_ids = self.florence_model.generate(
                input_ids=inputs["input_ids"],
                pixel_values=inputs["pixel_values"],
                max_new_tokens=128,
                num_beams=3,
                do_sample=False,
            )

        generated_text = self.florence_processor.batch_decode(
            generated_ids,
            skip_special_tokens=False,
        )[0]

        parsed = self.florence_processor.post_process_generation(
            generated_text,
            task=task_prompt,
            image_size=(image.width, image.height),
        )

        return parsed.get(task_prompt, generated_text)

    def translate_en_to_vi(self, text: str) -> str:
        if not self.use_translator:
            return text

        if not text or not text.strip():
            return ""

        inputs = self.translate_tokenizer(
            text,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=256,
        ).to(self.device)

        with torch.no_grad():
            translated_ids = self.translate_model.generate(
                **inputs,
                max_new_tokens=256,
                num_beams=4,
            )

        return self.translate_tokenizer.decode(
            translated_ids[0],
            skip_special_tokens=True,
        )

    def encode_text_bge(self, text: str) -> List[float]:
        vector = self.bge_model.encode(
            text,
            normalize_embeddings=True,
        )
        return vector.tolist()

    def encode_texts_bge(self, texts: List[str], batch_size: int = 8) -> List[List[float]]:
        vectors = self.bge_model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return vectors.tolist()
    
    def encode_text_sparse(self, text: str) -> SparseVector:
        """
        Encode 1 đoạn text thành sparse vector BM25.
        Dùng để bắt keyword.
        """

        sparse_embedding = next(self.sparse_model.embed([text]))

        return SparseVector(
            indices=sparse_embedding.indices.tolist(),
            values=sparse_embedding.values.tolist(),
        )


    def encode_texts_sparse(self, texts: list[str]) -> list[SparseVector]:
        """
        Encode nhiều đoạn text thành sparse vectors BM25.
        """

        sparse_embeddings = self.sparse_model.embed(texts)

        results = []

        for sparse_embedding in sparse_embeddings:
            results.append(
                SparseVector(
                    indices=sparse_embedding.indices.tolist(),
                    values=sparse_embedding.values.tolist(),
                )
            )

        return results

    def get_siglip_dim(self) -> int:
        return len(self.encode_text_siglip("test image"))

    def get_bge_dim(self) -> int:
        return len(self.encode_text_bge("test caption"))
