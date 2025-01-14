"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = messageHandler;
const baileys_1 = require("@whiskeysockets/baileys");
const utils_1 = require("../utils");
const db_1 = require("../../db");
const shared_1 = require("../../shared");
const getKeyAuthor = (key) => ((key === null || key === void 0 ? void 0 : key.fromMe) ? "me" : (key === null || key === void 0 ? void 0 : key.participant) || (key === null || key === void 0 ? void 0 : key.remoteJid)) || "";
function messageHandler(sessionId, event) {
    let listening = false;
    const set = async ({ messages, isLatest }) => {
        try {
            await db_1.prisma.$transaction(async (tx) => {
                if (isLatest)
                    await tx.message.deleteMany({ where: { sessionId } });
                await tx.message.createMany({
                    data: messages.map((message) => (Object.assign(Object.assign({}, (0, utils_1.transformPrisma)(message)), { remoteJid: message.key.remoteJid, id: message.key.id, sessionId }))),
                });
            });
            shared_1.logger.info({ messages: messages.length }, "Synced messages");
        }
        catch (e) {
            shared_1.logger.error(e, "An error occured during messages set");
        }
    };
    const upsert = async ({ messages, type }) => {
        switch (type) {
            case "append":
            case "notify":
                for (const message of messages) {
                    try {
                        const jid = (0, baileys_1.jidNormalizedUser)(message.key.remoteJid);
                        const data = (0, utils_1.transformPrisma)(message);
                        await db_1.prisma.message.upsert({
                            select: { pkId: true },
                            create: {
                                remoteJid: jid,
                                id: message.key.id,
                                sessionId: sessionId,
                                message: data.message, // Pastikan ini ada
                                key: data.key, // Pastikan ini ada
                            },
                            update: Object.assign({}, data),
                            where: { sessionId_remoteJid_id: { remoteJid: jid, id: message.key.id, sessionId } }
                        });
                        const chatExists = (await db_1.prisma.chat.count({ where: { id: jid, sessionId } })) > 0;
                        if (type === "notify" && !chatExists) {
                            event.emit("chats.upsert", [
                                {
                                    id: jid,
                                    conversationTimestamp: (0, baileys_1.toNumber)(message.messageTimestamp),
                                    unreadCount: 1,
                                },
                            ]);
                        }
                    }
                    catch (e) {
                        shared_1.logger.error(e, "An error occurred during message upsert");
                    }
                }
                break;
        }
    };
    const update = async (updates) => {
        for (const { update, key } of updates) {
            try {
                await db_1.prisma.$transaction(async (tx) => {
                    const prevData = await tx.message.findFirst({
                        where: { id: key.id, remoteJid: key.remoteJid, sessionId },
                    });
                    if (!prevData) {
                        return shared_1.logger.info({ update }, "Got update for non existent message");
                    }
                    const data = Object.assign(Object.assign({}, prevData), update);
                    await tx.message.delete({
                        select: { pkId: true },
                        where: {
                            sessionId_remoteJid_id: {
                                id: key.id,
                                remoteJid: key.remoteJid,
                                sessionId,
                            },
                        },
                    });
                    await tx.message.create({
                        select: { pkId: true },
                        data: Object.assign(Object.assign({}, (0, utils_1.transformPrisma)(data)), { id: data.key.id, remoteJid: data.key.remoteJid, sessionId }),
                    });
                });
            }
            catch (e) {
                shared_1.logger.error(e, "An error occured during message update");
            }
        }
    };
    const del = async (item) => {
        try {
            if ("all" in item) {
                await db_1.prisma.message.deleteMany({ where: { remoteJid: item.jid, sessionId } });
                return;
            }
            const jid = item.keys[0].remoteJid;
            await db_1.prisma.message.deleteMany({
                where: { id: { in: item.keys.map((k) => k.id) }, remoteJid: jid, sessionId },
            });
        }
        catch (e) {
            shared_1.logger.error(e, "An error occured during message delete");
        }
    };
    const updateReceipt = async (updates) => {
        for (const { key, receipt } of updates) {
            try {
                await db_1.prisma.$transaction(async (tx) => {
                    const message = await tx.message.findFirst({
                        select: { userReceipt: true },
                        where: { id: key.id, remoteJid: key.remoteJid, sessionId },
                    });
                    if (!message) {
                        return shared_1.logger.debug({ update }, "Got receipt update for non existent message");
                    }
                    let userReceipt = (message.userReceipt || []);
                    const recepient = userReceipt.find((m) => m.userJid === receipt.userJid);
                    if (recepient) {
                        userReceipt = [...userReceipt.filter((m) => m.userJid !== receipt.userJid), receipt];
                    }
                    else {
                        userReceipt.push(receipt);
                    }
                    await tx.message.update({
                        select: { pkId: true },
                        data: (0, utils_1.transformPrisma)({ userReceipt: userReceipt }),
                        where: {
                            sessionId_remoteJid_id: { id: key.id, remoteJid: key.remoteJid, sessionId },
                        },
                    });
                });
            }
            catch (e) {
                shared_1.logger.error(e, "An error occured during message receipt update");
            }
        }
    };
    const updateReaction = async (reactions) => {
        for (const { key, reaction } of reactions) {
            try {
                await db_1.prisma.$transaction(async (tx) => {
                    const message = await tx.message.findFirst({
                        select: { reactions: true },
                        where: { id: key.id, remoteJid: key.remoteJid, sessionId },
                    });
                    if (!message) {
                        return shared_1.logger.debug({ update }, "Got reaction update for non existent message");
                    }
                    const authorID = getKeyAuthor(reaction.key);
                    const reactions = (message.reactions || []).filter((r) => getKeyAuthor(r.key) !== authorID);
                    if (reaction.text)
                        reactions.push(reaction);
                    await tx.message.update({
                        select: { pkId: true },
                        data: (0, utils_1.transformPrisma)({ reactions: reactions }),
                        where: {
                            sessionId_remoteJid_id: { id: key.id, remoteJid: key.remoteJid, sessionId },
                        },
                    });
                });
            }
            catch (e) {
                shared_1.logger.error(e, "An error occured during message reaction update");
            }
        }
    };
    const listen = () => {
        if (listening)
            return;
        event.on("messaging-history.set", set);
        event.on("messages.upsert", upsert);
        event.on("messages.update", update);
        event.on("messages.delete", del);
        event.on("message-receipt.update", updateReceipt);
        event.on("messages.reaction", updateReaction);
        listening = true;
    };
    const unlisten = () => {
        if (!listening)
            return;
        event.off("messaging-history.set", set);
        event.off("messages.upsert", upsert);
        event.off("messages.update", update);
        event.off("messages.delete", del);
        event.off("message-receipt.update", updateReceipt);
        event.off("messages.reaction", updateReaction);
        listening = false;
    };
    return { listen, unlisten };
}
