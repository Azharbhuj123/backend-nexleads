const jwt = require("jsonwebtoken");
const { sendResponse } = require("../utils/helper");
const { authRoles } = require("../utils/enums");

module.exports.verifyToken = (req, res, next) => {
  const authtoken = req.headers["authorization"];
  if (!authtoken) {
    return res.status(401).send(sendResponse(false, null, "Token not found"));
  }
  const token = authtoken.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send(sendResponse(false, null, "Invalid token"));
    }
    req.user = decoded;
    next();
  });
};

module.exports.verifyInspectToken = (req, res, next) => {
  const authtoken = req.headers["authorization"];
  if (!authtoken) {
    return res.status(401).send(sendResponse(false, null, "Token not found"));
  };
  const token = authtoken.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send(sendResponse(false, null, "Invalid token"));
    };
    if (decoded.role !== authRoles[1]) {
      return res.status(400).send(sendResponse(false, null, "Forbidden"));
    };
    req.user = decoded;
    next();
  });
};

module.exports.verifyAdminToken = (req, res, next) => {
  const authtoken = req.headers["authorization"];
  if (!authtoken) {
    return res.status(401).send(sendResponse(false, null, "Token not found"));
  }
  const token = authtoken.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send(sendResponse(false, null, "Invalid token"));
    }
    if (decoded.role !== authRoles[2]) {
      return res.status(400).send(sendResponse(false, null, "Forbidden"));
    }
    req.user = decoded;
    next();
  });
}; 