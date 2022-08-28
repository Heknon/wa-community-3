import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {Chat} from "@prisma/client";
import {CommandTrigger, EconomyCommand} from "../../..";
import {BlockedReason} from "../../../../blockable";
import languages from "../../../../config/language.json";
import {User} from "../../../../db/types";
import Message from "../../../../messaging/message";
import {getInventory} from "../../../../user/inventory";
import { commas } from "../../../../utils/utils";

export default class InventoryCommand extends EconomyCommand {
    private language: typeof languages.commands.inventory[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.inventory;
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
        const inventory = getInventory(user);
        const placeholder = this.getDefaultPlaceholder({chat, user, message});
        if (inventory.length === 0) {
            return await message.replyAdvanced(
                {
                    text: this.language.execution.no_items,
                    buttons: this.language.execution.buttons.map((e, i) => {
                        return {buttonId: i.toString(), buttonText: {displayText: e}};
                    }),
                },
                true,
                {placeholder},
            );
        }

        let inventoryText = `${this.language.execution.request_title}\n\n`;
        for (const item of inventory) {
            inventoryText += `${this.language.execution.format
                .replace("{name}", item.item?.name[this.langCode] ?? "DELETED")
                .replace("{quantity}", commas(item.quantity))
                .replace("{id}", item.item?.id ?? "DELETED")
                .replace("{category}", item.item?.type ?? "DELETED")}\n\n`;
        }

        // remove last newline
        inventoryText = inventoryText.slice(0, -2);
        message.replyAdvanced(
            {
                text: inventoryText,
                mentions: [message.senderJid!],
                buttons: this.language.execution.buttons.map((e, i) => {
                    return {buttonId: i.toString(), buttonText: {displayText: e}};
                }),
            },
            true,
            {placeholder},
        );
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
