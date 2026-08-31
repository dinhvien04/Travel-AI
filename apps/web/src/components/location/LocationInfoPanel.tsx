import { MapPinned } from "lucide-react";

import type { LocationInfo } from "../../types/location.types";

type LocationInfoPanelProps = {
  location?: LocationInfo | null;
};

export function LocationInfoPanel({ location }: LocationInfoPanelProps) {
  if (!location) {
    return null;
  }

  return (
    <section className="location-panel" aria-label="Thông tin địa điểm">
      <div className="location-title">
        <MapPinned aria-hidden="true" size={18} />
        <div>
          <h3>{location.location_name || "Địa điểm"}</h3>
          {location.province ? <span>{location.province}</span> : null}
        </div>
      </div>
      {location.description ? <p>{location.description}</p> : null}
      {location.tags?.length ? (
        <div className="tag-list">
          {location.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
