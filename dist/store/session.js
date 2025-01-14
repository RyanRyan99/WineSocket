"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSession = useSession;
const baileys_1 = require("@whiskeysockets/baileys");
const baileys_2 = require("@whiskeysockets/baileys");
const db_1 = require("../db");
const shared_1 = require("../shared");
const library_1 = require("@prisma/client/runtime/library");
const zlib_1 = require("zlib"); // Import zlib untuk kompresi data
const buffer_1 = require("buffer"); // Import Buffer jika belum ada
const fixId = (id) => id.replace(/\//g, "__").replace(/:/g, "-");
// Fungsi untuk mengkompresi data
const compressData = (data) => {
    // Konversi data menjadi Buffer, lalu ke Uint8Array
    const bufferData = buffer_1.Buffer.from(data, "utf-8");
    const compressedBuffer = (0, zlib_1.gzipSync)(new Uint8Array(bufferData)); // Ubah ke Uint8Array sebelum dikompres
    return compressedBuffer.toString("base64");
};
// Fungsi untuk mendekompres data
const decompressData = (data) => {
    // Konversi Base64 ke Buffer, lalu ke Uint8Array
    const compressedBuffer = buffer_1.Buffer.from(data, "base64");
    const decompressedBuffer = (0, zlib_1.gunzipSync)(new Uint8Array(compressedBuffer)); // Ubah ke Uint8Array sebelum didekompres
    return decompressedBuffer.toString("utf-8");
};
async function useSession(sessionId) {
    const model = db_1.prisma.session;
    const write = async (data, id) => {
        try {
            data = JSON.stringify(data, baileys_2.BufferJSON.replacer);
            id = fixId(id);
            // Kompres data sebelum disimpan
            const compressedData = compressData(data);
            await model.upsert({
                select: { pkId: true },
                create: { data: compressedData, id, sessionId },
                update: { data: compressedData },
                where: { sessionId_id: { id, sessionId } },
            });
            console.log(`Data berhasil disimpan dengan ukuran asli: ${data.length} dan ukuran kompresi: ${compressedData.length}`);
        }
        catch (e) {
            shared_1.logger.error(e, "An error occured during session write");
        }
    };
    const read = async (id) => {
        try {
            const result = await model.findUnique({
                select: { data: true },
                where: { sessionId_id: { id: fixId(id), sessionId } },
            });
            if (!result) {
                shared_1.logger.info({ id }, "Trying to read non existent session data");
                return null;
            }
            // Dekompres data setelah dibaca
            const decompressedData = decompressData(result.data);
            return JSON.parse(decompressedData, baileys_2.BufferJSON.reviver);
        }
        catch (e) {
            if (e instanceof library_1.PrismaClientKnownRequestError && e.code === "P2025") {
                shared_1.logger.info({ id }, "Trying to read non existent session data");
            }
            else {
                shared_1.logger.error(e, "An error occured during session read");
            }
            return null;
        }
    };
    const del = async (id) => {
        try {
            await model.delete({
                select: { pkId: true },
                where: { sessionId_id: { id: fixId(id), sessionId } },
            });
        }
        catch (e) {
            shared_1.logger.error(e, "An error occured during session delete");
        }
    };
    const creds = (await read("creds")) || (0, baileys_2.initAuthCreds)();
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await read(`${type}-${id}`);
                        if (type === "app-state-sync-key" && value) {
                            value = baileys_1.proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const sId = `${category}-${id}`;
                            tasks.push(value ? write(value, sId) : del(sId));
                        }
                    }
                    await Promise.all(tasks);
                },
            },
        },
        saveCreds: () => write(creds, "creds"),
    };
}
