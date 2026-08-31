const { okResponse } = require("./responseFormatter");

function ok(data) {
  return okResponse(data);
}

module.exports = {
  ok,
};
