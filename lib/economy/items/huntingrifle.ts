import { User } from "../../db/types";
import Message from "../../messaging/message";
import Item from "./item";

export class HuntingRifle extends Item {
    public use(executor: User, message?: Message | undefined) {
        message?.reply("BOOOM BOOM");
    }
}
