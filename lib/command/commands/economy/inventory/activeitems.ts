import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {Chat} from "@prisma/client";
import moment from "moment";
import {CommandTrigger, EconomyCommand} from "../../..";
import {BlockedReason} from "../../../../blockable";
import languages from "../../../../config/language.json";
import {User} from "../../../../db/types";
import {getItemData} from "../../../../economy/items";
import Message from "../../../../messaging/message";
import "moment-duration-format";
import { hasActiveItemExpired } from "../../../../economy/utils";

export default class ActiveItemsCommand extends EconomyCommand {
    private language: typeof languages.commands.activeitems[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.activeitems;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
        });

        this.language = lang;
        this.langCode = language;
    }

    async execute(
        client: WASocket,
        chat: Chat,
        user: User,
        message: Message,
        body: string,
        trigger: CommandTrigger,
    ) {
        const placeholder = this.getDefaultPlaceholder({chat, user, message});
        const activeItems = user.activeItems.filter(e => !hasActiveItemExpired(e));
        if (activeItems.length === 0) {
            return await message.replyAdvanced(
                {
                    text: this.language.execution.no_items,
                },
                true,
                {placeholder},
            );
        }

        let activeText = `${this.language.execution.request_title}\n\n`;
        for (const item of activeItems) {
            const itemData = getItemData(item.itemId);
            const expireDuration = item.expire
                ? moment.duration(item.expire.getTime() - Date.now(), "milliseconds")
                : undefined;
            activeText += `${this.language.execution.format
                .replace("{name}", itemData?.name[this.langCode] ?? "DELETED")
                .replace(
                    "{time}",
                    expireDuration
                        ? expireDuration.format("d[d] h[h] m[m] s[s]")
                        : this.language.execution.never,
                )}\n\n`;
        }

        // remove last newline
        activeText = activeText.slice(0, -2);
        message.replyAdvanced(
            {
                text: activeText,
                mentions: [message.senderJid!],
            },
            true,
            {placeholder},
        );
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
