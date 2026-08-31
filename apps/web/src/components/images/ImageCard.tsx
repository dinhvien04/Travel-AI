import { ImageOff, MapPin } from "lucide-react";

import type { ImageItem } from "../../types/image.types";
import { formatScore } from "../../utils/formatScore";

type ImageCardProps = {
  image: ImageItem;
};

function getCaption(image: ImageItem) {
  return image.caption || image.caption_vi || image.caption_en || "Chưa có mô tả ảnh";
}

export function ImageCard({ image }: ImageCardProps) {
  const score = formatScore(image.final_score ?? image.score);

  return (
    <article className="image-card">
      <div className="image-card-media">
        {image.image_url ? (
          <img src={image.image_url} alt={getCaption(image)} loading="lazy" />
        ) : (
          <div className="image-placeholder">
            <ImageOff aria-hidden="true" size={26} />
            <span>Không thể tải ảnh</span>
          </div>
        )}
        {image.rank ? <span className="image-rank">#{image.rank}</span> : null}
      </div>
      <div className="image-card-body">
        <p>{getCaption(image)}</p>
        <div className="image-card-meta">
          {image.location_name ? (
            <span>
              <MapPin aria-hidden="true" size={13} />
              {image.location_name}
            </span>
          ) : null}
          {score ? <span>{score}</span> : null}
        </div>
      </div>
    </article>
  );
}
