import { axiosClient } from "./axiosClient";

export function getLocationDebug(locationId: string) {
  return axiosClient.get(`/api/debug/location/${encodeURIComponent(locationId)}`);
}
