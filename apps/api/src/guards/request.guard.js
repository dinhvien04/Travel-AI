class RequestGuard {
  canHandle() {
    return { allowed: true };
  }
}

module.exports = {
  RequestGuard,
};
