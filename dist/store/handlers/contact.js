"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = contactHandler;
const utils_1 = require("../utils");
const db_1 = require("../../db");
const shared_1 = require("../../shared");
const library_1 = require("@prisma/client/runtime/library");
function contactHandler(sessionId, event) {
    let listening = false;
    const set = async ({ contacts }) => {
        try {
            const contactIds = contacts.map((c) => c.id);
            const deletedOldContactIds = (await db_1.prisma.contact.findMany({
                select: { id: true },
                where: { id: { notIn: contactIds }, sessionId },
            })).map((c) => c.id);
            const upsertPromises = contacts
                .map((c) => (0, utils_1.transformPrisma)(c))
                .map((data) => db_1.prisma.contact.upsert({
                select: { pkId: true },
                create: Object.assign(Object.assign({}, data), { sessionId }),
                update: data,
                where: { sessionId_id: { id: data.id, sessionId } },
            }));
            await Promise.any([
                ...upsertPromises,
                db_1.prisma.contact.deleteMany({ where: { id: { in: deletedOldContactIds }, sessionId } }),
            ]);
            shared_1.logger.info({ deletedContacts: deletedOldContactIds.length, newContacts: contacts.length }, "Synced contacts");
        }
        catch (e) {
            shared_1.logger.error(e, "An error occured during contacts set");
        }
    };
    const upsert = async (contacts) => {
        try {
            await Promise.any(contacts
                .map((c) => (0, utils_1.transformPrisma)(c))
                .map((data) => db_1.prisma.contact.upsert({
                select: { pkId: true },
                create: Object.assign(Object.assign({}, data), { sessionId }),
                update: data,
                where: { sessionId_id: { id: data.id, sessionId } },
            })));
        }
        catch (e) {
            shared_1.logger.error(e, "An error occured during contacts upsert");
        }
    };
    const update = async (updates) => {
        for (const update of updates) {
            try {
                await db_1.prisma.contact.update({
                    select: { pkId: true },
                    data: (0, utils_1.transformPrisma)(update),
                    where: {
                        sessionId_id: { id: update.id, sessionId },
                    },
                });
            }
            catch (e) {
                if (e instanceof library_1.PrismaClientKnownRequestError && e.code === "P2025") {
                    return shared_1.logger.info({ update }, "Got update for non existent contact");
                }
                shared_1.logger.error(e, "An error occured during contact update");
            }
        }
    };
    const listen = () => {
        if (listening)
            return;
        event.on("messaging-history.set", set);
        event.on("contacts.upsert", upsert);
        event.on("contacts.update", update);
        listening = true;
    };
    const unlisten = () => {
        if (!listening)
            return;
        event.off("messaging-history.set", set);
        event.off("contacts.upsert", upsert);
        event.off("contacts.update", update);
        listening = false;
    };
    return { listen, unlisten };
}
