import {Chat, User} from "../../db/types";
import Message from "../../messaging/message";
import Item from "./item";
import languages from "../../config/language.json";
import {prisma} from "../../db/client";
import cuid from "cuid";
import { messagingService } from "../../messaging";
import moment from "moment";

export class Apple extends Item {
    private static language = languages.items["apple"];

    public async use(chat: Chat, executor: User, message?: Message | undefined) {
        const active = executor.activeItems.find((item) => item.itemId === "apple");

        const in24hours = moment().utc().add(24, "hours").toDate();
        await prisma.activeItem.upsert({
            where: {
                id: active?.id ?? cuid(),
            },
            create: {
                itemId: "apple",
                user: {connect: {jid: executor.jid}},
                expire: in24hours,
            },
            update: {
                expire: in24hours,
            },
        });

        await message?.reply(Apple.language[chat.language], true, {
            placeholder: {},
        });
        
        return true;
    }
}
