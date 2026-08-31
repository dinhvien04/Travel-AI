const { GetObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const { appConfig } = require("../config/env");
const { parseS3Path: parseRawS3Path } = require("../utils/s3Path");

function encodeS3KeyForUrl(s3Key) {
  return String(s3Key || "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

class S3Service {
  constructor(options = {}) {
    this.config = options.config || appConfig;
    this.s3Client = options.s3Client || null;
    this.getSignedUrlFn = options.getSignedUrlFn || getSignedUrl;
  }

  parseS3Path(s3Path) {
    const parsed = parseRawS3Path(s3Path);

    return {
      bucket: parsed.bucket,
      s3_bucket: parsed.bucket,
      s3_key: parsed.s3_key,
    };
  }

  async getImageUrlFromS3Path(s3Path) {
    const parsed = this.parseS3Path(s3Path);

    if (!parsed.bucket || !parsed.s3_key) {
      console.log(`[S3Service] Invalid s3_path=${s3Path || "null"}`);
      return null;
    }

    if (this.config.s3.urlMode === "public") {
      return this.buildPublicUrl(parsed.bucket, parsed.s3_key);
    }

    if (this.config.s3.urlMode === "presigned") {
      return this.buildPresignedUrl(parsed.bucket, parsed.s3_key);
    }

    console.log(`[S3Service] Unsupported S3_URL_MODE=${this.config.s3.urlMode}`);
    return null;
  }

  async attachImageUrls(images = []) {
    const results = [];

    for (const image of images) {
      const parsed = this.parseS3Path(image?.s3_path);
      const imageUrl = await this.getImageUrlFromS3Path(image?.s3_path);

      results.push({
        ...image,
        s3_bucket: image?.s3_bucket || parsed.s3_bucket,
        s3_key: image?.s3_key || parsed.s3_key,
        image_url: imageUrl,
      });
    }

    return results;
  }

  buildPublicUrl(bucket, s3Key) {
    const encodedKey = encodeS3KeyForUrl(s3Key);
    const region = this.config.aws.region;

    if (region) {
      return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
    }

    return `https://${bucket}.s3.amazonaws.com/${encodedKey}`;
  }

  async buildPresignedUrl(bucket, s3Key) {
    try {
      const client = this.getClient();
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: s3Key,
      });

      return await this.getSignedUrlFn(client, command, {
        expiresIn: this.config.s3.presignedExpiresIn,
      });
    } catch (error) {
      console.log(`[S3Service] Cannot create presigned URL: ${error.message}`);
      return null;
    }
  }

  getClient() {
    if (this.s3Client) {
      return this.s3Client;
    }

    const clientConfig = {
      region: this.config.aws.region,
    };

    if (this.config.aws.accessKeyId && this.config.aws.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: this.config.aws.accessKeyId,
        secretAccessKey: this.config.aws.secretAccessKey,
      };
    }

    this.s3Client = new S3Client(clientConfig);
    return this.s3Client;
  }
}

const s3Service = new S3Service();

module.exports = {
  S3Service,
  encodeS3KeyForUrl,
  s3Service,
};
