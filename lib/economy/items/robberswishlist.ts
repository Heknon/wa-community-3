import {Chat, User} from "../../db/types";
import Message from "../../messaging/message";
import Item from "./item";
import languages from '../../config/language.json';

export class RobbersWishlist extends Item {
    private static language = languages.items['robberswishlist'];

    public use(chat: Chat, executor: User, message?: Message | undefined) {
        return true;
    }
}
