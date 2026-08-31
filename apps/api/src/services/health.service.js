class HealthService {
  getStatus() {
    return {
      status: "ok",
      service: "travel-ai-assistant-api",
      timestamp: new Date().toISOString(),
    };
  }
}

const healthService = new HealthService();

module.exports = {
  healthService,
  HealthService,
};
