const { healthService } = require("../services/health.service");
const { qdrantHealthService } = require("../services/qdrantHealthService");
const { errorResponse, okResponse } = require("../utils/responseFormatter");

class HealthController {
  check(_req, res) {
    res.status(200).json(okResponse(healthService.getStatus()));
  }

  async checkQdrant(_req, res) {
    console.log("[Health] Checking Qdrant external connection");

    const result = await qdrantHealthService.check();

    if (!result.success) {
      console.log(`[Health] Qdrant check failed: ${result.error_code}`);

      return res.status(503).json(
        errorResponse(result.error_code, result.message, {
          data: result.data,
        }),
      );
    }

    console.log("[Health] Qdrant check passed");

    return res.status(200).json(
      okResponse(result.data, {
        message: "Qdrant connection is healthy.",
      }),
    );
  }
}

const healthController = new HealthController();

module.exports = {
  healthController,
  HealthController,
};
