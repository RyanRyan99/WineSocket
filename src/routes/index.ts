import { Router } from "express";
import chatRoutes from "./chats";
import groupRoutes from "./groups";
import messageRoutes from "./messages";
import sessionRoutes from "./sessions";
import contactRoutes from "./contacts";
import incomingchat from "./incomingchats";
import { apiKeyValidator } from "@/middlewares/key-validator";

const router = Router();
router.use("/sessions", sessionRoutes);
router.use("/:sessionId/chats", apiKeyValidator, chatRoutes);
router.use("/:sessionId/contacts", apiKeyValidator, contactRoutes);
router.use("/:sessionId/groups", apiKeyValidator, groupRoutes);
router.use("/:sessionId/messages", apiKeyValidator, messageRoutes);
router.use("/:sessionId/incomingchats", apiKeyValidator, incomingchat)

export default router;