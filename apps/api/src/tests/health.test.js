const assert = require("node:assert/strict");
const { test } = require("node:test");

const { healthService } = require("../services/health.service");

test("health service returns ok status", () => {
  const result = healthService.getStatus();

  assert.equal(result.status, "ok");
  assert.equal(result.service, "travel-ai-assistant-api");
  assert.match(result.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});
