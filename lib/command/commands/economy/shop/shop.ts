import {jidDecode, WASocket} from "@adiwajshing/baileys";
import Sticker, {StickerTypes} from "wa-sticker-formatter/dist";
import moment from "moment";
import {Command, CommandTrigger} from "../../..";
import {BlockedReason} from "../../../../blockable";
import languages from "../../../../config/language.json";
import Message from "../../../../messaging/message";
import {Chat, User} from "../../../../db/types";
import {getAllItems} from "../../../../economy/items";
import { commas } from "../../../../utils/utils";

export default class ShopCommand extends Command {
    private language: typeof languages.commands.shop[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.shop;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
        });

        this.langCode = language;
        this.language = lang;
    }

    async execute(
        client: WASocket,
        chat: Chat,
        user: User,
        message: Message,
        body: string,
        trigger: CommandTrigger,
    ) {
        let shopText = this.language.execution.title + "\n";
        const items = getAllItems();
        for (const item of items) {
            if (item.value <= 0 || !item.flags.PURCHASEABLE) continue;
            shopText +=
                this.language.execution.item
                    .replace("{name}", item.name[this.langCode])
                    .replace("{quantity}", commas(user.items.find(e => e.itemId == item.id)?.quantity ?? 0))
                    .replace('{price}', commas(item.value))
                    .replace('{description}', item.description?.[this.langCode] ?? "No description") + "\n\n";
        }

        shopText.trim();
        message.replyAdvanced({text: shopText, buttons: this.language.execution.buttons.map(e => {
            return {buttonId: e, buttonText: {displayText: e}};
        })}, true, {
            placeholder: this.getDefaultPlaceholder({chat, user}),
        });
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
