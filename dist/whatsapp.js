"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = init;
exports.createSession = createSession;
exports.getSessionStatus = getSessionStatus;
exports.listSessions = listSessions;
exports.getSession = getSession;
exports.deleteSession = deleteSession;
exports.sessionExists = sessionExists;
exports.jidExists = jidExists;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const store_1 = require("./store");
const db_1 = require("./db");
const shared_1 = require("./shared");
const qrcode_1 = require("qrcode");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const sessions = new Map();
const retries = new Map();
const SSEQRGenerations = new Map();
const RECONNECT_INTERVAL = Number(process.env.RECONNECT_INTERVAL || 0);
const MAX_RECONNECT_RETRIES = Number(process.env.MAX_RECONNECT_RETRIES || 5);
const SSE_MAX_QR_GENERATION = Number(process.env.SSE_MAX_QR_GENERATION || 5);
const SESSION_CONFIG_ID = "session-config";
async function init() {
    const sessions = await db_1.prisma.session.findMany({
        select: { sessionId: true, data: true },
        where: { id: { startsWith: SESSION_CONFIG_ID } },
    });
    for (const { sessionId, data } of sessions) {
        const _a = JSON.parse(data), { readIncomingMessages } = _a, socketConfig = __rest(_a, ["readIncomingMessages"]);
        createSession({ sessionId, readIncomingMessages, socketConfig });
    }
}
function shouldReconnect(sessionId) {
    var _a;
    let attempts = (_a = retries.get(sessionId)) !== null && _a !== void 0 ? _a : 0;
    if (attempts < MAX_RECONNECT_RETRIES) {
        attempts += 1;
        retries.set(sessionId, attempts);
        return true;
    }
    return false;
}
async function createSession(options) {
    const { sessionId, res, SSE = false, readIncomingMessages = false, socketConfig } = options;
    const configID = `${SESSION_CONFIG_ID}-${sessionId}`;
    let connectionState = { connection: "close" };
    const destroy = async (logout = true) => {
        try {
            await Promise.all([
                logout && socket.logout(),
                db_1.prisma.chat.deleteMany({ where: { sessionId } }),
                db_1.prisma.contact.deleteMany({ where: { sessionId } }),
                db_1.prisma.message.deleteMany({ where: { sessionId } }),
                db_1.prisma.groupMetadata.deleteMany({ where: { sessionId } }),
                db_1.prisma.session.deleteMany({ where: { sessionId } }),
            ]);
            shared_1.logger.info({ session: sessionId }, "Session destroyed");
        }
        catch (e) {
            shared_1.logger.error(e, "An error occured during session destroy");
        }
        finally {
            sessions.delete(sessionId);
        }
    };
    const handleConnectionClose = () => {
        var _a, _b, _c, _d;
        const code = (_c = (_b = (_a = connectionState.lastDisconnect) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.output) === null || _c === void 0 ? void 0 : _c.statusCode;
        const restartRequired = code === baileys_1.DisconnectReason.restartRequired;
        const doNotReconnect = !shouldReconnect(sessionId);
        if (code === baileys_1.DisconnectReason.loggedOut || doNotReconnect) {
            if (res) {
                !SSE && !res.headersSent && res.status(500).json({ error: "Unable to create session" });
                res.end();
            }
            destroy(doNotReconnect);
            return;
        }
        if (!restartRequired) {
            shared_1.logger.info({ attempts: (_d = retries.get(sessionId)) !== null && _d !== void 0 ? _d : 1, sessionId }, "Reconnecting...");
        }
        setTimeout(() => createSession(options), restartRequired ? 0 : RECONNECT_INTERVAL);
    };
    const handleNormalConnectionUpdate = async () => {
        var _a;
        if ((_a = connectionState.qr) === null || _a === void 0 ? void 0 : _a.length) {
            if (res && !res.headersSent) {
                try {
                    const qr = await (0, qrcode_1.toDataURL)(connectionState.qr);
                    res.status(200).json({ qr });
                    return;
                }
                catch (e) {
                    shared_1.logger.error(e, "An error occured during QR generation");
                    res.status(500).json({ error: "Unable to generate QR" });
                }
            }
            destroy();
        }
    };
    const handleSSEConnectionUpdate = async () => {
        var _a, _b;
        let qr = undefined;
        if ((_a = connectionState.qr) === null || _a === void 0 ? void 0 : _a.length) {
            try {
                qr = await (0, qrcode_1.toDataURL)(connectionState.qr);
            }
            catch (e) {
                shared_1.logger.error(e, "An error occured during QR generation");
            }
        }
        const currentGenerations = (_b = SSEQRGenerations.get(sessionId)) !== null && _b !== void 0 ? _b : 0;
        if (!res || res.writableEnded || (qr && currentGenerations >= SSE_MAX_QR_GENERATION)) {
            res && !res.writableEnded && res.end();
            destroy();
            return;
        }
        const data = Object.assign(Object.assign({}, connectionState), { qr });
        if (qr)
            SSEQRGenerations.set(sessionId, currentGenerations + 1);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    const handleConnectionUpdate = SSE ? handleSSEConnectionUpdate : handleNormalConnectionUpdate;
    const { state, saveCreds } = await (0, store_1.useSession)(sessionId);
    const socket = (0, baileys_1.default)(Object.assign(Object.assign({ printQRInTerminal: true, connectTimeoutMs: 120000, browser: [process.env.NAME_BOT_BROWSER || "Whatsapp Bot", "Chrome", "3.0"], generateHighQualityLinkPreview: true }, socketConfig), { auth: {
            creds: state.creds,
            keys: (0, baileys_1.makeCacheableSignalKeyStore)(state.keys, shared_1.logger),
        }, version: [2, 3000, 1015901307], //2, 2413, 1
        logger: //2, 2413, 1
        shared_1.logger, shouldIgnoreJid: (jid) => (0, baileys_1.isJidBroadcast)(jid), getMessage: async (key) => {
            const data = await db_1.prisma.message.findFirst({
                where: { remoteJid: key.remoteJid, id: key.id, sessionId },
            });
            return ((data === null || data === void 0 ? void 0 : data.message) || undefined);
        } }));
    const store = new store_1.Store(sessionId, socket.ev);
    sessions.set(sessionId, Object.assign(Object.assign({}, socket), { destroy, store }));
    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", (update) => {
        connectionState = update;
        const { connection } = update;
        if (connection === "open") {
            retries.delete(sessionId);
            SSEQRGenerations.delete(sessionId);
        }
        if (connection === "close")
            handleConnectionClose();
        handleConnectionUpdate();
    });
    socket.ev.on("messages.upsert", async (m) => {
        const message = m.messages[0];
        console.log(m.messages[0]);
        if (message.key.fromMe || m.type !== "notify")
            return;
        //await delay(1000);
        //await socket.readMessages([message.key]);
    });
    if (readIncomingMessages) {
        socket.ev.on("messages.upsert", async (m) => {
            const message = m.messages[0];
            console.log(m.messages[0]);
            if (message.key.fromMe || m.type !== "notify")
                return;
            //await delay(1000);
            //await socket.readMessages([message.key]);
        });
    }
    // Debug events
    // socket.ev.on("messaging-history.set", (data) => dump("messaging-history.set", data));
    // socket.ev.on("chats.upsert", (data) => dump("chats.upsert", data));
    // socket.ev.on("contacts.update", (data) => dump("contacts.update", data));
    // socket.ev.on("groups.upsert", (data) => dump("groups.upsert", data));
    await db_1.prisma.session.upsert({
        create: {
            id: configID,
            sessionId,
            data: JSON.stringify(Object.assign({ readIncomingMessages }, socketConfig)),
        },
        update: {},
        where: { sessionId_id: { id: configID, sessionId } },
    });
}
function getSessionStatus(session) {
    const state = ["CONNECTING", "CONNECTED", "DISCONNECTING", "DISCONNECTED"];
    let status = state[session.ws.readyState];
    status = session.user ? "AUTHENTICATED" : status;
    return status;
}
function listSessions() {
    return Array.from(sessions.entries()).map(([id, session]) => ({
        id,
        status: getSessionStatus(session),
    }));
}
function getSession(sessionId) {
    return sessions.get(sessionId);
}
async function deleteSession(sessionId) {
    var _a;
    (_a = sessions.get(sessionId)) === null || _a === void 0 ? void 0 : _a.destroy();
}
function sessionExists(sessionId) {
    return sessions.has(sessionId);
}
async function jidExists(session, jid, type = "number") {
    try {
        if (type === "number") {
            const [result] = await session.onWhatsApp(jid);
            return !!(result === null || result === void 0 ? void 0 : result.exists);
        }
        const groupMeta = await session.groupMetadata(jid);
        return !!groupMeta.id;
    }
    catch (e) {
        return Promise.reject(e);
    }
}
