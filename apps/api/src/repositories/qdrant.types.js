/**
 * @typedef {Object} QdrantPointPayload
 * @property {string=} location_id
 * @property {string=} location_key
 * @property {string=} location_name
 * @property {string=} s3_path
 */

/**
 * @typedef {Object} LocationMetadata
 * @property {string|null} location_id
 * @property {string|null} location_key
 * @property {string|null} location_name
 * @property {string|null} province
 * @property {string|null} description
 * @property {string[]} tags
 */

/**
 * @typedef {Object} DocumentChunkResult
 * @property {string|null} chunk_id
 * @property {string|null} section_id
 * @property {string|null} location_id
 * @property {string|null} location_key
 * @property {string|null} document_type
 * @property {string|null} source_file
 * @property {string|null} s3_path
 * @property {string|null} section_number
 * @property {string|null} section_title
 * @property {number|null} chunk_index
 * @property {number|null} total_chunks
 * @property {string|null} content
 * @property {number|null} score
 * @property {number|null} rank
 */

/**
 * @typedef {Object} ImageSearchResult
 * @property {string|null} image_id
 * @property {string|null} title_name
 * @property {string|null} s3_path
 * @property {string|null} s3_bucket
 * @property {string|null} s3_key
 * @property {string|null} image_url
 * @property {string|null} caption
 * @property {string|null} caption_vi
 * @property {string|null} caption_en
 * @property {string|null} location_id
 * @property {string|null} location_key
 * @property {string|null} location_name
 * @property {number|null} score
 * @property {number|null} rank
 * @property {string|null} source
 */

/**
 * @typedef {Object} HybridImageSearchResult
 * @property {string|null} image_id
 * @property {string|null} title_name
 * @property {string|null} s3_path
 * @property {string|null} s3_bucket
 * @property {string|null} s3_key
 * @property {string|null} image_url
 * @property {string|null} caption
 * @property {string|null} caption_vi
 * @property {string|null} caption_en
 * @property {string|null} location_id
 * @property {string|null} location_key
 * @property {string|null} location_name
 * @property {number} final_score
 * @property {number} siglip_score
 * @property {number} caption_score
 * @property {string[]} sources
 * @property {number} rank
 */

/**
 * @typedef {Object} HybridImageSearchParams
 * @property {string} queryText
 * @property {number[]} siglipTextVector
 * @property {number[]} bgeTextVector
 * @property {string=} locationId
 * @property {number=} topK
 * @property {{ siglip?: number, caption?: number }=} weights
 */

module.exports = {};
