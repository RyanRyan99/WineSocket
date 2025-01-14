"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = groupMetadataHandler;
const utils_1 = require("../utils");
const db_1 = require("../../db");
const shared_1 = require("../../shared");
const library_1 = require("@prisma/client/runtime/library");
function groupMetadataHandler(sessionId, event) {
    const model = db_1.prisma.groupMetadata;
    let listening = false;
    const upsert = async (groups) => {
        const promises = [];
        for (const group of groups) {
            const data = (0, utils_1.transformPrisma)(group);
            promises.push(model.upsert({
                select: { pkId: true },
                create: Object.assign(Object.assign({}, data), { sessionId }),
                update: data,
                where: { sessionId_id: { id: group.id, sessionId } },
            }));
        }
        try {
            await Promise.all(promises);
        }
        catch (e) {
            shared_1.logger.error(e, "An error occured during groups upsert");
        }
    };
    const update = async (updates) => {
        for (const update of updates) {
            try {
                await model.update({
                    select: { pkId: true },
                    data: (0, utils_1.transformPrisma)(update),
                    where: { sessionId_id: { id: update.id, sessionId } },
                });
            }
            catch (e) {
                if (e instanceof library_1.PrismaClientKnownRequestError && e.code === "P2025")
                    return shared_1.logger.info({ update }, "Got metadata update for non existent group");
                shared_1.logger.error(e, "An error occured during group metadata update");
            }
        }
    };
    const updateParticipant = async ({ id, action, participants, }) => {
        try {
            const metadata = ((await model.findFirst({
                select: { participants: true },
                where: { id, sessionId },
            })) || []);
            if (!metadata) {
                return shared_1.logger.info({ update: { id, action, participants } }, "Got participants update for non existent group");
            }
            switch (action) {
                case "add":
                    metadata.participants.push(participants.map((id) => ({ id, isAdmin: false, isSuperAdmin: false })));
                    break;
                case "demote":
                case "promote":
                    for (const participant of metadata.participants) {
                        if (participants.includes(participant.id)) {
                            participant.isAdmin = action === "promote";
                        }
                    }
                    break;
                case "remove":
                    metadata.participants = metadata.participants.filter((p) => !participants.includes(p.id));
                    break;
            }
            await model.update({
                select: { pkId: true },
                data: (0, utils_1.transformPrisma)({ participants: metadata.participants }),
                where: { sessionId_id: { id, sessionId } },
            });
        }
        catch (e) {
            shared_1.logger.error(e, "An error occured during group participants update");
        }
    };
    const listen = () => {
        if (listening)
            return;
        event.on("groups.upsert", upsert);
        event.on("groups.update", update);
        event.on("group-participants.update", updateParticipant);
        listening = true;
    };
    const unlisten = () => {
        if (!listening)
            return;
        event.off("groups.upsert", upsert);
        event.off("groups.update", update);
        event.off("group-participants.update", updateParticipant);
        listening = false;
    };
    return { listen, unlisten };
}
