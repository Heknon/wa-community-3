import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {EconomyCommand} from "../..";
import {BlockedReason} from "../../../blockable";
import {commas} from "../../../utils/utils";
import CommandTrigger from "../../command_trigger";
import {buildBalanceChangeMessage, extractNumbers} from "./utils";
import languages from "../../../config/language.json";
import {Chat, User} from "../../../db/types";
import Message from "../../../messaging/message";
import {getUserMoney, userCalculateNetBalance} from "../../../user/user";

export default class DepositCommand extends EconomyCommand {
    private language: typeof languages.commands.deposit[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.deposit;
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
        const userMoney = await getUserMoney(user);
        user.money = userMoney ?? null;
        if (!user.money) {
            return await message.reply(this.language.execution.no_balance, true);
        }

        const bankCapacity = user.money.bankCapacity;
        const net = (await userCalculateNetBalance(user)) ?? 0;

        const allowedDeposit = bankCapacity - user.money.bank;
        // if body starts with 'all' or 'max' then deposit max
        const depositAmount = ["all", "max"].some((e) => body.startsWith(e))
            ? Math.min(allowedDeposit, user.money.wallet)
            : Number(extractNumbers(body)[0] ?? "");
        if (depositAmount == 0) {
            return await message.reply(this.language.execution.cant_deposit, true);
        }
        if (!depositAmount) {
            return await message.reply(this.language.execution.no_body, true, {
                placeholder: {
                    chat,
                    command: this,
                },
            });
        }

        if (depositAmount > allowedDeposit || depositAmount < 0) {
            return await message.reply(this.language.execution.capacity_error, true, {
                placeholder: {
                    custom: {
                        capacity: commas(bankCapacity),
                    },
                },
            });
        }

        const updatedBal = await this.addBalance(user, {wallet: -depositAmount, bank: depositAmount});
        if (!updatedBal) {
            return await message.reply(this.language.execution.error, true, {
                placeholder: {
                    chat,
                },
            });
        }

        const prevBalance = user.money;
        user.money = updatedBal;
        const currentNet = await userCalculateNetBalance(user);
        const balChangeMessage = buildBalanceChangeMessage(
            prevBalance,
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
