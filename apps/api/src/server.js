const { app } = require("./app");
const { appConfig } = require("./config/env");
const host = appConfig.host || "0.0.0.0";
const server = app.listen(appConfig.port, host, () => {
  console.log(
    `Travel AI Assistant API is running at http://${host}:${appConfig.port}${appConfig.apiPrefix}`,
  );
});

function shutdown() {
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
