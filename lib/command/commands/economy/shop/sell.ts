import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {CommandTrigger, EconomyCommand} from "../../..";
import {BlockedReason} from "../../../../blockable";
import languages from "../../../../config/language.json";
import {Chat, User} from "../../../../db/types";
import getItem, {getAllItems} from "../../../../economy/items";
import Message from "../../../../messaging/message";
import {Placeholder} from "../../../../messaging/types";
import {
    getInventory,
    getInventoryItem,
    giveItemToUser,
    userRegisterItemUse,
} from "../../../../user/inventory";
import {commas} from "../../../../utils/utils";

export default class SellCommand extends EconomyCommand {
    private language: typeof languages.commands.sell[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.sell;
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
        const itemData = getAllItems().find((e) =>
            [e.id, ...Object.values(e.name)].some(
                (e) => body.toLowerCase().indexOf(e.toLowerCase().trim()) > -1,
            ),
        );

        const invItem = itemData ? getInventoryItem(user, itemData.id) : undefined;
        const textNum = Number(/\d+/.exec(body)?.[0]);
        const amount = textNum ? Math.min(textNum, invItem?.quantity ?? 1) || 1 : 1;
        const isSellable = itemData?.type.toLowerCase() === "sellable";
        const sellValue = isSellable ? itemData.value ?? 0 : (itemData?.value ?? 0) / 1000;
        const price = sellValue * amount;
        const placeholder = this.getDefaultPlaceholder({
            chat,
            user,
            message,
            custom: {
                item: itemData?.name[this.langCode] ?? "N/A",
                quantity: commas(amount),
                price: commas(price),
            },
        });

        if (!itemData) {
            return message.replyAdvanced(
                {
                    text: this.language.execution.no_item,
                },
                true,
                {placeholder},
            );
        } else if (sellValue <= 0) {
            return message.replyAdvanced(
                {
                    text: this.language.execution.no_sell,
                },
                true,
                {placeholder},
            );
        }

        if (!invItem) {
            await message.reply(this.language.execution.no_item_inv, true);
            return;
        }

        if (amount > 1) {
            const confirmMessage = await this.sendConfirmMessage(message, placeholder);
            const confirmResponse = await this.validatedWaitForInteractionWith(
                message!,
                async (msg) => {
                    await this.sendConfirmMessage(message, placeholder);
                },
                30 * 1000,
                () => {
                    return message.reply(this.language.execution.timeout, true, {
                        placeholder,
                    });
                },
                "1",
                "2",
                "כן",
                "לא",
                "yes",
                "no",
            );
            if (!confirmResponse) return;
            const content = confirmResponse.content
                ?.replace("לא", "no")
                .replace("כן", "yes")
                .replace("1", "no")
                .replace("2", "yes");
            if (content === "no" || !content) {
                return message.reply(this.language.execution.cancelled, true, {
                    placeholder,
                });
            }
        }

        await this.addBalance(user, {wallet: price});
        await giveItemToUser(user, itemData.id, -1 * amount);
        const successMessage = `${this.language.execution.success.title}\n${this.language.execution.success.description}`;
        message.replyAdvanced(
            {
                text: successMessage,
                mentions: [user.jid],
            },
            true,
            {placeholder},
        );
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}

    private sendConfirmMessage(message: Message, placeholder: Placeholder) {
        return message.replyAdvanced(
            {
                text: this.language.execution.confirm,
                buttons: [
                    {
                        buttonId: "0",
                        buttonText: {displayText: this.language.execution.confirm_buttons[0]},
                    },
                    {
                        buttonId: "1",
                        buttonText: {displayText: this.language.execution.confirm_buttons[1]},
                    },
                ],
            },
            true,
            {
                placeholder,
            },
        );
    }
}
