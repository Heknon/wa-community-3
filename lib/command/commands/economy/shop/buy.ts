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

export default class BuyCommand extends EconomyCommand {
    private language: typeof languages.commands.buy[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.buy;
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

        const amount = Number(/\d+/.exec(body)?.[0]) || 1;
        const price = (itemData?.buy ?? 0) * amount;
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
                    buttons: this.language.execution.buttons.map((e, i) => {
                        return {buttonId: i.toString(), buttonText: {displayText: e}};
                    }),
                },
                true,
                {placeholder},
            );
        } else if (itemData.buy <= 0) {
            return message.replyAdvanced(
                {
                    text: this.language.execution.no_buy,
                },
                true,
                {placeholder},
            );
        }

        if ((user.money?.wallet ?? 0) < price) {
            return await message.reply(this.language.execution.no_money, true, {
                placeholder,
            });
        }

        if (amount > 1) {
            const confirmMessage = await this.sendConfirmMessage(message, placeholder);
            const confirmResponse = await this.validatedWaitForInteractionWith(
                confirmMessage!,
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
                .replace("2", "no")
                .replace("1", "yes");
            if (content === "no" || !content) {
                return message.reply(this.language.execution.cancelled, true, {
                    placeholder,
                });
            }
        }

        await this.removeBalance(user, {wallet: price});
        await giveItemToUser(user, itemData.id, amount);
        const successMessage = `${this.language.execution.success.title}\n${this.language.execution.success.description}\n\n${this.language.execution.success.footer}`;
        message.replyAdvanced(
            {
                text: successMessage,
                mentions: [user.jid],
                buttons: this.language.execution.success.buttons.map((e, i) => {
                    return {buttonId: i.toString(), buttonText: {displayText: e}};
                }),
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
