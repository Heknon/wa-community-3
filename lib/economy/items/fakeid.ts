import {Chat, User} from "../../db/types";
import Message from "../../messaging/message";
import Item from "./item";
import languages from "../../config/language.json";
import {adjectives, colors, Config} from "unique-names-generator";
import {uniqueNamesGenerator, animals, starWars} from "unique-names-generator";
import {prisma} from "../../db/client";
import cuid from "cuid";

const nameGenConfig: Config = {
    dictionaries: [adjectives, colors, animals, starWars],
    separator: " ",
    length: 2,
};

export class FakeID extends Item {
    private static language = languages.items["fakeid"];

    public async use(chat: Chat, executor: User, message?: Message | undefined) {
        const name = uniqueNamesGenerator(nameGenConfig);
        const active = executor.activeItems.find((item) => item.itemId === "fakeid");

        const in7days = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
        await prisma.activeItem.upsert({
            where: {
                id: active?.id ?? cuid(),
            },
            create: {
                itemId: "fakeid",
                user: {connect: {jid: executor.jid}},
                data: {
                    name
                },
                expire: in7days,
            },
            update: {
                expire: in7days,
            },
        });
        await message?.reply(FakeID.language[chat.language], true, {
            placeholder: {
                custom: {
                    identity: name,
                },
            },
            privateReply: true,
        });
        return true;
    }
}
