/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
	AuthenticationCreds,
	AuthenticationState,
	SignalDataTypeMap,
} from "@whiskeysockets/baileys";
import { proto } from "@whiskeysockets/baileys";
import { BufferJSON, initAuthCreds } from "@whiskeysockets/baileys";
import { prisma } from "@/db";
import { logger } from "@/shared";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { gzipSync, gunzipSync } from "zlib"; // Import zlib untuk kompresi data
import { Buffer } from "buffer"; // Import Buffer jika belum ada

const fixId = (id: string) => id.replace(/\//g, "__").replace(/:/g, "-");

// Fungsi untuk mengkompresi data
const compressData = (data: string): string => {
	// Konversi data menjadi Buffer, lalu ke Uint8Array
	const bufferData = Buffer.from(data, "utf-8");
	const compressedBuffer = gzipSync(new Uint8Array(bufferData)); // Ubah ke Uint8Array sebelum dikompres
	return compressedBuffer.toString("base64");
};

// Fungsi untuk mendekompres data
const decompressData = (data: string): string => {
	// Konversi Base64 ke Buffer, lalu ke Uint8Array
	const compressedBuffer = Buffer.from(data, "base64");
	const decompressedBuffer = gunzipSync(new Uint8Array(compressedBuffer)); // Ubah ke Uint8Array sebelum didekompres
	return decompressedBuffer.toString("utf-8");
};

export async function useSession(sessionId: string): Promise<{
	state: AuthenticationState;
	saveCreds: () => Promise<void>;
}> {
	const model = prisma.session;

	const write = async (data: any, id: string) => {
		try {
			data = JSON.stringify(data, BufferJSON.replacer);
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
		} catch (e) {
			logger.error(e, "An error occured during session write");
		}
	};

	const read = async (id: string) => {
		try {
			const result = await model.findUnique({
				select: { data: true },
				where: { sessionId_id: { id: fixId(id), sessionId } },
			});

			if (!result) {
				logger.info({ id }, "Trying to read non existent session data");
				return null;
			}

			// Dekompres data setelah dibaca
			const decompressedData = decompressData(result.data);

			return JSON.parse(decompressedData, BufferJSON.reviver);
		} catch (e) {
			if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
				logger.info({ id }, "Trying to read non existent session data");
			} else {
				logger.error(e, "An error occured during session read");
			}
			return null;
		}
	};

	const del = async (id: string) => {
		try {
			await model.delete({
				select: { pkId: true },
				where: { sessionId_id: { id: fixId(id), sessionId } },
			});
		} catch (e) {
			logger.error(e, "An error occured during session delete");
		}
	};

	const creds: AuthenticationCreds = (await read("creds")) || initAuthCreds();

	return {
		state: {
			creds,
			keys: {
				get: async <T extends keyof SignalDataTypeMap>(
					type: T,
					ids: string[],
				): Promise<{
					[id: string]: SignalDataTypeMap[T];
				}> => {
					const data: { [key: string]: SignalDataTypeMap[typeof type] } = {};
					await Promise.all(
						ids.map(async (id) => {
							let value = await read(`${type}-${id}`);
							if (type === "app-state-sync-key" && value) {
								value = proto.Message.AppStateSyncKeyData.fromObject(value);
							}
							data[id] = value;
						}),
					);
					return data;
				},
				set: async (data: any): Promise<void> => {
					const tasks: Promise<void>[] = [];

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
