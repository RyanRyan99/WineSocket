"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = chatHandler;
const utils_1 = require("../utils");
const db_1 = require("../../db");
const shared_1 = require("../../shared");
const library_1 = require("@prisma/client/runtime/library");
function chatHandler(sessionId, event) {
    let listening = false;
    const set = async ({ chats, isLatest }) => {
        try {
            await db_1.prisma.$transaction(async (tx) => {
                if (isLatest)
                    await tx.chat.deleteMany({ where: { sessionId } });
                const existingIds = (await tx.chat.findMany({
                    select: { id: true },
                    where: { id: { in: chats.map((c) => c.id) }, sessionId },
                })).map((i) => i.id);
                const chatsAdded = (await tx.chat.createMany({
                    data: chats
                        .filter((c) => !existingIds.includes(c.id))
                        .map((c) => (Object.assign(Object.assign({}, (0, utils_1.transformPrisma)(c)), { sessionId }))),
                })).count;
                shared_1.logger.info({ chatsAdded }, "Synced chats");
            });
        }
        catch (e) {
            shared_1.logger.error(e, "An error occured during chats set");
        }
    };
    const upsert = async (chats) => {
        try {
            await Promise.any(chats
                .map((c) => (0, utils_1.transformPrisma)(c))
                .map((data) => db_1.prisma.chat.upsert({
                select: { pkId: true },
                create: Object.assign(Object.assign({}, data), { sessionId }),
                update: data,
                where: { sessionId_id: { id: data.id, sessionId } },
            })));
        }
        catch (e) {
            shared_1.logger.error(e, "An error occured during chats upsert");
        }
    };
    const update = async (updates) => {
        for (const update of updates) {
            try {
                const data = (0, utils_1.transformPrisma)(update);
                await db_1.prisma.chat.update({
                    select: { pkId: true },
                    data: Object.assign(Object.assign({}, data), { unreadCount: typeof data.unreadCount === "number"
                            ? data.unreadCount > 0
                                ? { increment: data.unreadCount }
                                : { set: data.unreadCount }
                            : undefined }),
                    where: { sessionId_id: { id: update.id, sessionId } },
                });
            }
            catch (e) {
                if (e instanceof library_1.PrismaClientKnownRequestError && e.code === "P2025") {
                    return shared_1.logger.info({ update }, "Got update for non existent chat");
                }
                shared_1.logger.error(e, "An error occured during chat update");
            }
        }
    };
    const del = async (ids) => {
        try {
            await db_1.prisma.chat.deleteMany({
                where: { id: { in: ids } },
            });
        }
        catch (e) {
            shared_1.logger.error(e, "An error occured during chats delete");
        }
    };
    const listen = () => {
        if (listening)
            return;
        event.on("messaging-history.set", set);
        event.on("chats.upsert", upsert);
        event.on("chats.update", update);
        event.on("chats.delete", del);
        listening = true;
    };
    const unlisten = () => {
        if (!listening)
            return;
        event.off("messaging-history.set", set);
        event.off("chats.upsert", upsert);
        event.off("chats.update", update);
        event.off("chats.delete", del);
        listening = false;
    };
    return { listen, unlisten };
}
