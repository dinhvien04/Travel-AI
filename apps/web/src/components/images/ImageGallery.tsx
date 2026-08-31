import type { ImageItem } from "../../types/image.types";
import { ImageCard } from "./ImageCard";

type ImageGalleryProps = {
  images?: ImageItem[];
  title?: string;
};

export function ImageGallery({ images = [], title = "Hình ảnh liên quan" }: ImageGalleryProps) {
  if (!images.length) {
    return null;
  }

  return (
    <section className="image-gallery" aria-label={title}>
      <div className="section-heading">
        <h3>{title}</h3>
        <span>{images.length} ảnh</span>
      </div>
      <div className="image-grid">
        {images.map((image, index) => (
          <ImageCard
            key={image.image_id || `${image.location_id || "image"}-${index}`}
            image={image}
          />
        ))}
      </div>
    </section>
  );
}
