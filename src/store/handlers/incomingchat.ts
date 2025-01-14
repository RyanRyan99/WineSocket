import { IncomingChat } from './../../../node_modules/.prisma/client/index.d';
import type {
	BaileysEventEmitter,
	MessageUserReceipt,
	proto,
	WAMessageKey,
} from "@whiskeysockets/baileys";
import { jidNormalizedUser, toNumber } from "@whiskeysockets/baileys";
import type { BaileysEventHandler, MakeTransformedPrisma } from "@/store/types";
import { transformPrisma } from "@/store/utils";
import { prisma } from "@/db";
import { logger } from "@/shared";

const getKeyAuthor = (key: WAMessageKey | undefined | null) =>
	(key?.fromMe ? "me" : key?.participant || key?.remoteJid) || "";

export default function incomingchatHandler(sessionId: string, event: BaileysEventEmitter) {
	let listening = false;

	const upsert: BaileysEventHandler<"messages.upsert"> = async ({ messages, type }) => {
		switch (type) {
			case "append":
			case "notify":
				for (const message of messages) {
					try {
						// Cek jika pesan adalah pesan yang ditarik (revoke)
						if (message.message?.protocolMessage?.type === 4) {
							console.log('Pesan ini telah ditarik, mengabaikan...');
							continue; // Skip pesan yang ditarik
						}
	
						// Cek jika pesan adalah pesan reaksi
						if (message.message?.reactionMessage) {
							console.log(`Pesan ini adalah reaksi emoji: ${message.message.reactionMessage.text}, mengabaikan...`);
							continue; // Skip pesan reaksi
						}
	
						const jid = jidNormalizedUser(message.key.remoteJid!);
						const conversations = message.message?.conversation as string;
						const webconversation = message.message?.extendedTextMessage?.text as string;
						const pushnames = message.pushName as string;
						const fromMe = message.key.fromMe;
	
						// Gabungkan isi pesan
						const messageContent = conversations || webconversation;
	
						// Cek apakah messageContent memiliki nilai valid
						if (fromMe == false && messageContent) {
							await prisma.incomingChat.upsert({
								select: { pkId: true },
								create: {
									id: message.key.id!,
									sessionId: sessionId,
									remoteJid: jid,
									message: messageContent, // Gunakan messageContent yang sudah dicek
									pushName: pushnames,
									createdAt: new Date(),
								},
								update: {},
								where: { sessionId_remoteJid_id: { remoteJid: jid, id: message.key.id!, sessionId } },
							});
							console.log(`Pesan dari ${jid} telah disimpan ke database.`);
						} else {
							console.log(`Pesan kosong atau dikirim dari diri sendiri, mengabaikan...`);
						}
					} catch (e) {
						logger.error(e, "An error occurred during message upsert");
					}
				}
				break;
		}
	};
	

	const listen = () => {
		if (listening) return;

		event.on("messages.upsert", upsert);
		listening = true;
	};

	const unlisten = () => {
		if (!listening) return;

		event.off("messages.upsert", upsert);
		listening = false;
	};

	return { listen, unlisten };
}
