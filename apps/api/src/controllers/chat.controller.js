const { inputRouterService } = require("../services/inputRouter.service");
const { imageTextPipeline } = require("../pipelines/image-text.pipeline");
const { imageOnlyPipeline } = require("../pipelines/image-only.pipeline");
const { textOnlyPipeline } = require("../pipelines/text-only.pipeline");
const { errorResponse } = require("../utils/responseFormatter");

class ChatController {
  async handle(req, res) {
    console.log("[Chat] POST /api/chat received");

    const routeResult = inputRouterService.route({
      sessionId: req.body.session_id,
      message: req.body.message,
      image: req.file,
    });

    console.log(
      `[Chat] session_id=${routeResult.session_id || "null"} input_type=${routeResult.input_type}`,
    );

    if (routeResult.input_type === "empty_input") {
      console.log("[Chat] EMPTY_INPUT - message and image are both missing");

      return res.status(400).json(
        errorResponse("EMPTY_INPUT", "Please provide a message, an image, or both.", {
          data: routeResult,
        }),
      );
    }

    if (routeResult.input_type === "image_text") {
      let pipelineResult;

      try {
        pipelineResult = await imageTextPipeline.run({
          sessionId: routeResult.session_id,
          message: routeResult.message,
          inputType: routeResult.input_type,
          image: req.file,
        });
      } catch (error) {
        console.log(`[Chat] Image text pipeline error: ${error.message}`);

        return res.status(500).json(
          errorResponse("INTERNAL_ERROR", "Image text pipeline failed.", {
            data: {
              input_type: routeResult.input_type,
            },
          }),
        );
      }

      return res.status(pipelineResult.statusCode).json(pipelineResult.body);
    }

    if (routeResult.input_type === "image_only") {
      let pipelineResult;

      try {
        pipelineResult = await imageOnlyPipeline.run({
          sessionId: routeResult.session_id,
          inputType: routeResult.input_type,
          image: req.file,
        });
      } catch (error) {
        console.log(`[Chat] Image pipeline error: ${error.message}`);

        return res.status(500).json(
          errorResponse("INTERNAL_ERROR", "Image only pipeline failed.", {
            data: {
              input_type: routeResult.input_type,
            },
          }),
        );
      }

      return res.status(pipelineResult.statusCode).json(pipelineResult.body);
    }

    if (routeResult.input_type !== "text_only") {
      console.log(
        `[Chat] Pipeline not implemented for input_type=${routeResult.input_type}`,
      );

      return res.status(501).json(
        errorResponse(
          "PIPELINE_NOT_IMPLEMENTED",
          "Pipeline này chưa được implement trong phase hiện tại.",
          {
            data: {
              session_id: routeResult.session_id,
              input_type: routeResult.input_type,
            },
          },
        ),
      );
    }

    let pipelineResult;

    try {
      pipelineResult = await textOnlyPipeline.run({
        sessionId: routeResult.session_id,
        message: routeResult.message,
        inputType: routeResult.input_type,
      });
    } catch (error) {
      console.log(`[Chat] Text pipeline error: ${error.message}`);

      return res.status(500).json(
        errorResponse("INTERNAL_ERROR", "Text only pipeline failed.", {
          data: {
            input_type: routeResult.input_type,
          },
        }),
      );
    }

    return res.status(pipelineResult.statusCode).json(pipelineResult.body);
  }
}

const chatController = new ChatController();

module.exports = {
  chatController,
  ChatController,
};
