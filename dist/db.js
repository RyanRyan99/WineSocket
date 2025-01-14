"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const globalForPrisma = globalThis;
exports.prisma = new client_1.PrismaClient();
// export const prisma =
// 	globalForPrisma.prisma ||
// 	new PrismaClient({
// 		log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
// 	});
// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
