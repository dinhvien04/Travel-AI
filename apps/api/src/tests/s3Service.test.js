const assert = require("node:assert/strict");
const { test } = require("node:test");

const { S3Service, encodeS3KeyForUrl } = require("../services/s3.service");

test("s3 service parses path with and without s3 protocol", () => {
  const service = new S3Service({
    config: {
      aws: {},
      s3: {
        urlMode: "public",
        presignedExpiresIn: 900,
      },
    },
  });

  assert.deepEqual(service.parseS3Path("vietnam-tourism/HON_KHO/image/00008.jpg"), {
    bucket: "vietnam-tourism",
    s3_bucket: "vietnam-tourism",
    s3_key: "HON_KHO/image/00008.jpg",
  });
  assert.equal(
    service.parseS3Path("s3://vietnam-tourism/HON_KHO/image/00008.jpg").s3_key,
    "HON_KHO/image/00008.jpg",
  );
});

test("s3 service creates public image URL", async () => {
  const service = new S3Service({
    config: {
      aws: {
        region: "ap-southeast-1",
      },
      s3: {
        urlMode: "public",
        presignedExpiresIn: 900,
      },
    },
  });

  const imageUrl = await service.getImageUrlFromS3Path(
    "vietnam-tourism/HON_KHO/image/00008 test.jpg",
  );

  assert.equal(
    imageUrl,
    "https://vietnam-tourism.s3.ap-southeast-1.amazonaws.com/HON_KHO/image/00008%20test.jpg",
  );
});

test("s3 service attaches image URLs without mutating original items", async () => {
  const service = new S3Service({
    config: {
      aws: {
        region: "ap-southeast-1",
      },
      s3: {
        urlMode: "public",
        presignedExpiresIn: 900,
      },
    },
  });
  const images = [
    {
      image_id: "img-1",
      s3_path: "vietnam-tourism/HON_KHO/image/00008.jpg",
      image_url: null,
    },
  ];

  const result = await service.attachImageUrls(images);

  assert.equal(images[0].image_url, null);
  assert.equal(result[0].s3_bucket, "vietnam-tourism");
  assert.equal(result[0].s3_key, "HON_KHO/image/00008.jpg");
  assert.ok(result[0].image_url.includes("vietnam-tourism.s3.ap-southeast-1"));
});

test("encodeS3KeyForUrl keeps path separators", () => {
  assert.equal(encodeS3KeyForUrl("A B/file name.jpg"), "A%20B/file%20name.jpg");
});
