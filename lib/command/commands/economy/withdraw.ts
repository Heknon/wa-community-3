import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {EconomyCommand} from "../..";
import {BlockedReason} from "../../../blockable";
import CommandTrigger from "../../command_trigger";
import {buildBalanceChangeMessage, extractNumbers} from "./utils";
import languages from "../../../config/language.json";
import {Chat, User} from "../../../db/types";
import Message from "../../../messaging/message";
import {getUserMoney, userCalculateNetBalance} from "../../../user/user";

export default class WithdrawCommand extends EconomyCommand {
    private language: typeof languages.commands.withdraw[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.withdraw;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
            usage: lang.usage,
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
        if (!user.money) {
            user.money = (await getUserMoney(user)) ?? null;
            if (!user.money) return await message.reply(this.language.execution.no_balance, true);
        }

        const net = await userCalculateNetBalance(user);

        const bankTotal = user.money.bank;
        // if body starts with 'all' or 'max' then deposit max
        const withdrawAmount = ["all", "max"].some((e) => body.startsWith(e))
            ? bankTotal
            : Number(extractNumbers(body)[0] ?? "");
        if (withdrawAmount == 0) {
            return await message.reply(this.language.execution.cant_withdraw, true);
        }
        if (!withdrawAmount) {
            return await message.reply(this.language.execution.no_body, true, {
                placeholder: {
                    chat,
                },
            });
        }

        if (withdrawAmount > bankTotal || withdrawAmount < 0) {
            return await message.reply(this.language.execution.too_much, true, {
                placeholder: {
                    chat,
                    custom: {
                        max: bankTotal.toString(),
                    },
                },
            });
        }

        const addBalance = {wallet: withdrawAmount, bank: -withdrawAmount};
        const updatedBalance = await this.addBalance(user, addBalance);
        if (!updatedBalance) {
            return await message.reply( this.language.execution.error, true, {
                placeholder: {
                    chat,
                },
            });
        }


        const previousBalance = user.money;
        user.money = updatedBalance;
        const currentNet = await userCalculateNetBalance(user);
        const balChangeMessage = buildBalanceChangeMessage(
            previousBalance,
            user.money,
            net,
            currentNet,
            this.langCode,
            user.money.bankCapacity,
        );
        const reply = `${
            languages.commands.balance[this.langCode].execution.title
        }\n\n${balChangeMessage}`;
        return await message.replyAdvanced(
            {text: reply, mentions: [user.jid]},
            true,
            {
                placeholder: {
                    custom: {
                        tag: `@${user.phone}`,
                    },
                },
            },
        );
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
