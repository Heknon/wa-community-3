import {Chat, User} from "../../db/types";
import Message from "../../messaging/message";
import Item from "./item";
import languages from "../../config/language.json";
import {messagingService} from "../../messaging";
import {prisma} from "../../db/client";

export class Lifesaver extends Item {
    private static language = languages.items["lifesaver"];

    public async use(chat: Chat, executor: User, message?: Message | undefined) {
        const userChat = await prisma.chat.findUnique({where: {jid: executor.jid}});
        const userLanguage = userChat?.sentDisclaimer ? userChat.language : undefined;
        await messagingService?.sendMessage(chat.jid, {
            text: Lifesaver.language[userLanguage ?? chat.language],
        }, undefined, {
            placeholder: {
                custom: {
                    tag: '@' + executor.phone
                }
            },
            tags: [executor.jid]
        });
        return true;
    }
}
