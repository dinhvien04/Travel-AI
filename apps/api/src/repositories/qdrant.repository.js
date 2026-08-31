class QdrantRepository {
  constructor(collectionName) {
    this.collectionName = collectionName;
  }

  async search() {
    throw new Error(
      `QdrantRepository is a placeholder for external Qdrant integration later. Collection: ${this.collectionName || "not-set"}`,
    );
  }
}

module.exports = {
  QdrantRepository,
};
