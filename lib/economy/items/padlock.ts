import {Chat, User} from "../../db/types";
import Message from "../../messaging/message";
import Item from "./item";
import languages from "../../config/language.json";
import cuid from "cuid";
import {prisma} from "../../db/client";
import moment from "moment";

export class Padlock extends Item {
    private static language = languages.items["padlock"];

    public async use(chat: Chat, executor: User, message?: Message | undefined) {
        const active = executor.activeItems.find((item) => item.itemId === "padlock");

        const in1month = moment().utc().add(1, "month").toDate();
        await prisma.activeItem.upsert({
            where: {
                id: active?.id ?? cuid(),
            },
            create: {
                itemId: "padlock",
                user: {connect: {jid: executor.jid}},
                expire: in1month,
            },
            update: {
                expire: in1month,
            },
        });
        await message?.reply(Padlock.language[chat.language], true, {
            placeholder: {},
        });
        return true;
    }
}
