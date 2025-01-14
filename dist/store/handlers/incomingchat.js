"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = incomingchatHandler;
const baileys_1 = require("@whiskeysockets/baileys");
const db_1 = require("../../db");
const shared_1 = require("../../shared");
const getKeyAuthor = (key) => ((key === null || key === void 0 ? void 0 : key.fromMe) ? "me" : (key === null || key === void 0 ? void 0 : key.participant) || (key === null || key === void 0 ? void 0 : key.remoteJid)) || "";
function incomingchatHandler(sessionId, event) {
    let listening = false;
    const upsert = async ({ messages, type }) => {
        var _a, _b, _c, _d, _e, _f;
        switch (type) {
            case "append":
            case "notify":
                for (const message of messages) {
                    try {
                        // Cek jika pesan adalah pesan yang ditarik (revoke)
                        if (((_b = (_a = message.message) === null || _a === void 0 ? void 0 : _a.protocolMessage) === null || _b === void 0 ? void 0 : _b.type) === 4) {
                            console.log('Pesan ini telah ditarik, mengabaikan...');
                            continue; // Skip pesan yang ditarik
                        }
                        // Cek jika pesan adalah pesan reaksi
                        if ((_c = message.message) === null || _c === void 0 ? void 0 : _c.reactionMessage) {
                            console.log(`Pesan ini adalah reaksi emoji: ${message.message.reactionMessage.text}, mengabaikan...`);
                            continue; // Skip pesan reaksi
                        }
                        const jid = (0, baileys_1.jidNormalizedUser)(message.key.remoteJid);
                        const conversations = (_d = message.message) === null || _d === void 0 ? void 0 : _d.conversation;
                        const webconversation = (_f = (_e = message.message) === null || _e === void 0 ? void 0 : _e.extendedTextMessage) === null || _f === void 0 ? void 0 : _f.text;
                        const pushnames = message.pushName;
                        const fromMe = message.key.fromMe;
                        // Gabungkan isi pesan
                        const messageContent = conversations || webconversation;
                        // Cek apakah messageContent memiliki nilai valid
                        if (fromMe == false && messageContent) {
                            await db_1.prisma.incomingChat.upsert({
                                select: { pkId: true },
                                create: {
                                    id: message.key.id,
                                    sessionId: sessionId,
                                    remoteJid: jid,
                                    message: messageContent, // Gunakan messageContent yang sudah dicek
                                    pushName: pushnames,
                                    createdAt: new Date(),
                                },
                                update: {},
                                where: { sessionId_remoteJid_id: { remoteJid: jid, id: message.key.id, sessionId } },
                            });
                            console.log(`Pesan dari ${jid} telah disimpan ke database.`);
                        }
                        else {
                            console.log(`Pesan kosong atau dikirim dari diri sendiri, mengabaikan...`);
                        }
                    }
                    catch (e) {
                        shared_1.logger.error(e, "An error occurred during message upsert");
                    }
                }
                break;
        }
    };
    const listen = () => {
        if (listening)
            return;
        event.on("messages.upsert", upsert);
        listening = true;
    };
    const unlisten = () => {
        if (!listening)
            return;
        event.off("messages.upsert", upsert);
        listening = false;
    };
    return { listen, unlisten };
}
