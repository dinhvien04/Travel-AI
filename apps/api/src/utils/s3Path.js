function parseS3Path(s3Path) {
  if (!s3Path || typeof s3Path !== "string") {
    return {
      bucket: null,
      s3_key: null,
    };
  }

  const normalizedPath = s3Path.replace(/^s3:\/\//, "").replace(/^\/+/, "");
  const [bucket, ...keyParts] = normalizedPath.split("/");
  const s3Key = keyParts.join("/");

  return {
    bucket: bucket || null,
    s3_key: s3Key || null,
  };
}

module.exports = {
  parseS3Path,
};
