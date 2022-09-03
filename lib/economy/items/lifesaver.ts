import {Chat, User} from "../../db/types";
import Message from "../../messaging/message";
import Item from "./item";
import languages from "../../config/language.json";
import {messagingService} from "../../messaging";
import {prisma} from "../../db/client";

export class Lifesaver extends Item {
    private static language = languages.items["lifesaver"];

    public async use(chat: Chat, executor: User, message?: Message | undefined) {
        await message?.replyAdvanced({
            text: Lifesaver.language[chat.language],
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
