import { axiosClient } from "./axiosClient";

export function parseS3PathDebug(s3Path: string) {
  return axiosClient.post("/api/debug/s3/parse-path", { s3_path: s3Path });
}
