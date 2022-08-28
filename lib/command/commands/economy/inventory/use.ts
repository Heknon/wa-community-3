import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {CommandTrigger, EconomyCommand} from "../../..";
import {BlockedReason} from "../../../../blockable";
import languages from "../../../../config/language.json";
import {Chat, User} from "../../../../db/types";
import getItem, {getAllItems} from "../../../../economy/items";
import Message from "../../../../messaging/message";
import {getInventory, getInventoryItem, userRegisterItemUse} from "../../../../user/inventory";

export default class UseItemCommand extends EconomyCommand {
    private language: typeof languages.commands.use[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.use;
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
        const itemData = getAllItems().find(
            (e) => body.toLowerCase().indexOf(e.id.toLowerCase()) > -1,
        );
        const item = itemData ? getItem(itemData.id) : undefined;
        const placeholder = this.getDefaultPlaceholder({
            chat,
            user,
            message,
            custom: {
                item_name: itemData?.name[this.langCode] ?? "N/A",
            },
        });

        if (!item || !itemData) {
            return message.replyAdvanced(
                {
                    text: this.language.execution.invalid_item,
                    buttons: this.language.execution.buttons.map((e, i) => {
                        return {buttonId: i.toString(), buttonText: {displayText: e}};
                    }),
                },
                true,
                {placeholder},
            );
        }

        const invItem = getInventoryItem(user, item.data.id);
        if (!invItem || invItem.quantity <= 0) {
            if (invItem && invItem.quantity <= 0) {
                await userRegisterItemUse(user, item);
            }

            return await message.reply(this.language.execution.no_item, true, {
                placeholder,
            });
        }

        await item.use(user, message);
        await userRegisterItemUse(user, item);
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
