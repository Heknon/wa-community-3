import {Chat, User} from "../../db/types";
import Message from "../../messaging/message";
import Item from "./item";
import languages from "../../config/language.json";
import {messagingService} from "../../messaging";

export class Lifesaver extends Item {
    private static language = languages.items["lifesaver"];

    public async use(chat: Chat, executor: User, message?: Message | undefined) {
        await messagingService?.sendMessage(executor.jid, {
            text: Lifesaver.language[chat.language],
        });
        return true;
    }
}
