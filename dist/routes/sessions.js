"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = require("../controllers");
const session_validator_1 = __importDefault(require("../middlewares/session-validator"));
const request_validator_1 = __importDefault(require("../middlewares/request-validator"));
const express_validator_1 = require("express-validator");
const key_validator_1 = require("../middlewares/key-validator");
const router = (0, express_1.Router)();
router.get("/", key_validator_1.apiKeyValidator, controllers_1.session.list);
router.get("/:sessionId", key_validator_1.apiKeyValidator, session_validator_1.default, controllers_1.session.find);
router.get("/:sessionId/status", key_validator_1.apiKeyValidator, session_validator_1.default, controllers_1.session.status);
router.post("/add", (0, express_validator_1.body)("sessionId").isString().notEmpty(), key_validator_1.apiKeyValidator, request_validator_1.default, controllers_1.session.add);
router.get("/:sessionId/add-sse", key_validator_1.apiKeyValidatorParam, controllers_1.session.addSSE);
router.delete("/:sessionId", key_validator_1.apiKeyValidator, session_validator_1.default, controllers_1.session.del);
exports.default = router;
