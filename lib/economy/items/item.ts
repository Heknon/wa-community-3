import {ItemData} from ".";
import { User } from "../../db/types";
import Message from "../../messaging/message";

export default abstract class Item {
    constructor(public readonly data: ItemData) {}

    public abstract use(executor: User, message?: Message): any | Promise<any>;
}
