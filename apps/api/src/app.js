const cors = require("cors");
const express = require("express");
const multer = require("multer");

const { appConfig } = require("./config/env");
const { chatController } = require("./controllers/chat.controller");
const { debugController } = require("./controllers/debug.controller");
const { healthController } = require("./controllers/health.controller");

function createApp() {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage() });

  app.use(cors());
  app.use(express.json());

  app.get(`${appConfig.apiPrefix}/health`, healthController.check);
  app.get(`${appConfig.apiPrefix}/health/qdrant`, healthController.checkQdrant);
  app.post(`${appConfig.apiPrefix}/chat`, upload.single("image"), chatController.handle);
  app.get(
    `${appConfig.apiPrefix}/debug/location/:location_id`,
    debugController.getLocation.bind(debugController),
  );
  app.post(
    `${appConfig.apiPrefix}/debug/images/hybrid-search`,
    debugController.hybridImageSearch.bind(debugController),
  );
  app.post(
    `${appConfig.apiPrefix}/debug/docs/search-by-text-vector`,
    debugController.searchDocsByTextVector.bind(debugController),
  );
  app.post(
    `${appConfig.apiPrefix}/debug/images/search-by-image-vector`,
    debugController.searchImagesByImageVector.bind(debugController),
  );
  app.post(
    `${appConfig.apiPrefix}/debug/s3/parse-path`,
    debugController.parseS3Path.bind(debugController),
  );

  return app;
}

const app = createApp();

module.exports = {
  app,
  createApp,
};
