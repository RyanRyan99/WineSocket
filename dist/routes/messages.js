"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = require("../controllers");
const request_validator_1 = __importDefault(require("../middlewares/request-validator"));
const session_validator_1 = __importDefault(require("../middlewares/session-validator"));
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)({ mergeParams: true });
router.get("/", (0, express_validator_1.query)("cursor").isNumeric().optional(), (0, express_validator_1.query)("limit").isNumeric().optional(), request_validator_1.default, controllers_1.message.list);
router.post("/send", (0, express_validator_1.body)("jid").isString().notEmpty(), (0, express_validator_1.body)("type").isString().isIn(["group", "number"]).optional(), (0, express_validator_1.body)("message").isObject().notEmpty(), (0, express_validator_1.body)("options").isObject().optional(), request_validator_1.default, session_validator_1.default, controllers_1.message.send);
router.post("/send/bulk", (0, express_validator_1.body)().isArray().notEmpty(), request_validator_1.default, session_validator_1.default, controllers_1.message.sendBulk);
router.post("/download", (0, express_validator_1.body)().isObject().notEmpty(), request_validator_1.default, session_validator_1.default, controllers_1.message.download);
exports.default = router;
