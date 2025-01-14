"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const controllers_1 = require("../controllers");
const request_validator_1 = __importDefault(require("../middlewares/request-validator"));
const session_validator_1 = __importDefault(require("../middlewares/session-validator"));
const router = (0, express_1.Router)({ mergeParams: true });
router.get("/", (0, express_validator_1.query)("cursor").isNumeric().optional(), (0, express_validator_1.query)("limit").isNumeric().optional(), request_validator_1.default, controllers_1.contact.list);
router.get("/blocklist", session_validator_1.default, controllers_1.contact.listBlocked);
router.post("/blocklist/update", (0, express_validator_1.body)("jid").isString().notEmpty(), (0, express_validator_1.body)("action").isString().isIn(["block", "unblock"]).optional(), request_validator_1.default, session_validator_1.default, controllers_1.contact.updateBlock);
router.get("/:jid", session_validator_1.default, controllers_1.contact.check);
router.get("/:jid/photo", session_validator_1.default, controllers_1.contact.photo);
exports.default = router;
