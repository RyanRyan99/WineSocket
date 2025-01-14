"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
exports.logger = (0, pino_1.default)({
    timestamp: () => `,"time":"${new Date().toJSON()}"`,
    transport: {
        targets: [
            {
                level: process.env.LOG_LEVEL || "warn",
                target: "pino-pretty",
                options: {
                    colorize: true,
                },
            }
        ],
    },
    mixin(mergeObject, level) {
        return Object.assign(Object.assign({}, mergeObject), { level: level });
    },
});
