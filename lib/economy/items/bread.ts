import {Chat, User} from "../../db/types";
import Message from "../../messaging/message";
import Item from "./item";

export class Bread extends Item {
    public use(chat: Chat, executor: User, message?: Message | undefined) {
        message?.reply("😋😋😋");
        return true;
    }
}
