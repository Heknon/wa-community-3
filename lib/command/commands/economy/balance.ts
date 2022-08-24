import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {CommandTrigger, EconomyCommand} from "../..";
import {BlockedReason} from "../../../blockable";
import {commas} from "../../../utils/utils";
import languages from "../../../config/language.json";
import {Chat, User} from "../../../db/types";
import Message from "../../../messaging/message";
import {prisma} from "../../../db/client";
import { userCalculateNetBalance } from "../../../user/user";
import { createUser } from "../../../user/database_interactions";

export default class BalanceCommand extends EconomyCommand {
    private language: typeof languages.commands.balance[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.balance;
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
        const mentions = message.mentions;
        const userJid = mentions.length > 0 ? mentions[0] : message.senderJid;
        if (!userJid) {
            return await message.reply(this.language.execution.no_balance, true);
        }

        let userRequested = await prisma.user.findUnique({
            where: {jid: userJid},
            include: {money: true, items: true},
        });

        if (!userRequested) {
            userRequested = await createUser(userJid, '');
        }

        if (!userRequested || !userRequested.money) {
            return await message.reply(this.language.execution.no_balance, true);
        }

        const walletText = `${commas(userRequested.money.wallet)}`;
        const bankText = `${commas(userRequested.money.bank)} / ${commas(userRequested.money.bankCapacity)} (${(
            (userRequested.money.bank / userRequested.money.bankCapacity) *
            100
        ).toFixed(1)}%)`;
        const netText = `${commas(await userCalculateNetBalance(userRequested))}`;

        const reply = `${this.language.execution.title}\n\n*${
            languages.economy.wallet[this.langCode]
        }:* ${walletText}\n*${languages.economy.bank[this.langCode]}:* ${bankText}\n*${
            languages.economy.net[this.langCode]
        }:* ${netText}`;
        return await message.replyAdvanced({text: reply, mentions: [userJid]}, true, {
            placeholder: {
                custom: new Map([["tag", `@${jidDecode(userJid)?.user}`]]),
            },
        });
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
