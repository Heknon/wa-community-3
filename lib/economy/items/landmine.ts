import {Chat, User} from "../../db/types";
import Message from "../../messaging/message";
import Item from "./item";
import languages from "../../config/language.json";
import {prisma} from "../../db/client";
import cuid from "cuid";

export class Landmine extends Item {
    private static language = languages.items["landmine"];

    public async use(chat: Chat, executor: User, message?: Message | undefined) {
        const active = executor.activeItems.find((item) => item.itemId === "landmine");

        const in1day = new Date(Date.now() + 1000 * 60 * 60 * 24 * 1);
        await prisma.activeItem.upsert({
            where: {
                id: active?.id ?? cuid(),
            },
            create: {
                itemId: "landmine",
                user: {connect: {jid: executor.jid}},
                expire: in1day,
            },
            update: {
                expire: in1day,
            },
        });
        await message?.reply(Landmine.language[chat.language], true, {
            placeholder: {},
        });

        return true;
    }
}
