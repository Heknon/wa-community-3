import {ItemData} from ".";
import { Chat, User } from "../../db/types";
import Message from "../../messaging/message";

export default abstract class Item {
    constructor(public readonly data: ItemData) {}

    public abstract use(chat: Chat, executor: User, message?: Message): boolean | undefined | Promise<boolean | undefined>;
}
