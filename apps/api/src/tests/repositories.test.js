const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  ImageRepository,
  normalizeImagePayload,
} = require("../repositories/image.repository");
const { LocationRepository } = require("../repositories/location.repository");
const { buildLocationFilter } = require("../repositories/qdrantFilters");
const { TextRepository } = require("../repositories/text.repository");

test("buildLocationFilter creates Qdrant payload filter", () => {
  assert.deepEqual(buildLocationFilter("LOC_012"), {
    must: [
      {
        key: "location_id",
        match: {
          value: "LOC_012",
        },
      },
    ],
  });
});

test("normalizeImagePayload parses s3_path and caption fallback", () => {
  const image = normalizeImagePayload(
    {
      score: 0.91,
      payload: {
        image_id: "img-1",
        title_name: "00008.jpg",
        s3_path: "s3://vietnam-tourism/HON_KHO/image/00008.jpg",
        caption_en: "Beach island",
        location_id: "LOC_012",
      },
    },
    {
      rank: 1,
      source: "image_vector",
    },
  );

  assert.equal(image.s3_bucket, "vietnam-tourism");
  assert.equal(image.s3_key, "HON_KHO/image/00008.jpg");
  assert.equal(image.caption, "Beach island");
  assert.equal(image.image_url, null);
  assert.equal(image.score, 0.91);
  assert.equal(image.source, "image_vector");
});

test("text repository searches text_collection with text_vector", async () => {
  let capturedRequest;
  const repository = new TextRepository({
    collectionName: "text_collection",
    client: {
      async searchPoints(request) {
        capturedRequest = request;
        return [
          {
            score: 0.8,
            payload: {
              chunk_id: "chunk-1",
              content: "Noi dung chunk",
              location_id: "LOC_012",
            },
          },
        ];
      },
    },
  });

  const results = await repository.searchDocsByTextVector({
    textVector: [0.1, 0.2],
    locationId: "LOC_012",
    topK: 3,
  });

  assert.equal(capturedRequest.collectionName, "text_collection");
  assert.equal(capturedRequest.vectorName, "text_vector");
  assert.equal(results[0].content, "Noi dung chunk");
  assert.equal(results[0].rank, 1);
});

test("location repository finds location by normalized name", async () => {
  const repository = new LocationRepository({
    collectionName: "location_info",
    client: {
      async scrollPoints(request) {
        assert.equal(request.collectionName, "location_info");
        assert.equal(request.limit, 200);

        return [
          {
            payload: {
              location_id: "LOC_EG",
              location_key: "EO_GIO",
              location_name: "Eo Gio",
              province: "Binh Dinh",
              description: "Mock Eo Gio",
              tags: ["bien"],
            },
          },
        ];
      },
    },
  });

  const location = await repository.findLocationByName("eo gio");

  assert.equal(location.location_id, "LOC_EG");
  assert.equal(location.location_name, "Eo Gio");
});

test("image repository hybrid search merges by image_id and applies weights", async () => {
  const repository = new ImageRepository({
    collectionName: "image_collection",
    defaultTopK: 5,
    client: {
      async searchPoints(request) {
        if (request.vectorName === "image_vector") {
          return [
            {
              score: 0.6,
              payload: {
                image_id: "same-image",
                title_name: "same.jpg",
                s3_path: "vietnam-tourism/HON_KHO/image/same.jpg",
              },
            },
          ];
        }

        return [
          {
            score: 0.9,
            payload: {
              image_id: "same-image",
              title_name: "same.jpg",
              s3_path: "vietnam-tourism/HON_KHO/image/same.jpg",
            },
          },
          {
            score: 0.5,
            payload: {
              image_id: "caption-only",
              title_name: "caption.jpg",
              s3_path: "vietnam-tourism/HON_KHO/image/caption.jpg",
            },
          },
        ];
      },
    },
  });

  const results = await repository.hybridSearchImagesByText({
    queryText: "bien dao",
    siglipTextVector: [0.1, 0.2],
    bgeTextVector: [0.3, 0.4],
    topK: 5,
  });

  assert.equal(results[0].image_id, "same-image");
  assert.equal(results[0].siglip_score, 0.6);
  assert.equal(results[0].caption_score, 0.9);
  assert.equal(results[0].final_score, 0.81);
  assert.deepEqual(results[0].sources, [
    "siglip_text_to_image_vector",
    "caption_bge_m3_vector",
  ]);
  assert.equal(results[1].image_id, "caption-only");
  assert.equal(results[1].final_score, 0.35);
});
