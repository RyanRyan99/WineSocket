import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = new PrismaClient();

// export const prisma =
// 	globalForPrisma.prisma ||
// 	new PrismaClient({
// 		log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
// 	});

// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
