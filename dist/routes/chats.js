"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const controllers_1 = require("../controllers");
const request_validator_1 = __importDefault(require("../middlewares/request-validator"));
const router = (0, express_1.Router)({ mergeParams: true });
router.get("/", (0, express_validator_1.query)("cursor").isNumeric().optional(), (0, express_validator_1.query)("limit").isNumeric().optional(), request_validator_1.default, controllers_1.chat.list);
router.get("/:jid", (0, express_validator_1.query)("cursor").isNumeric().optional(), (0, express_validator_1.query)("limit").isNumeric().optional(), request_validator_1.default, controllers_1.chat.find);
exports.default = router;
