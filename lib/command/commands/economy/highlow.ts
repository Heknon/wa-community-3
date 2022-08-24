import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {AccountType} from "@prisma/client";
import {CommandTrigger, EconomyCommand} from "../..";
import {BlockedReason} from "../../../blockable";
import languages from "../../../config/language.json";
import {Chat, User} from "../../../db/types";
import Message from "../../../messaging/message";
import {getUserRandom} from "../../../user/user";
import {commas} from "../../../utils/utils";

export default class HighlowCommand extends EconomyCommand {
    private language: typeof languages.commands.highlow[Language];

    constructor(language: Language) {
        const langs = languages.commands.highlow;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
            usage: lang.usage,
            cooldowns: new Map([
                [AccountType.USER, 30000],
                [AccountType.DONOR, 15000],
                [AccountType.SPONSOR, 10000],
            ]),
        });

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
        const rand = getUserRandom(user);
        const secretNumber = rand.intBetween(1, 100);
        const higherLowerNumber = rand.intBetween(1, 100);
        const isHigher = secretNumber > higherLowerNumber;

        const optionsText = this.language.execution.options;
        const highlowMessage = `${this.language.execution.game_text}\n\n${optionsText}`;
        await message.replyAdvanced({text: highlowMessage, mentions: [user.jid]}, true, {
            placeholder: {
                custom: {
                    number: higherLowerNumber.toString(),
                    tag: `@${user.phone}`,
                },
            },
        });
        const highlowResult = await this.validatedWaitForInteractionWith(
            message,
            () => message.reply(optionsText, true),
            undefined,
            undefined,
            "1",
            "2",
            "3",
        );
        if (!highlowResult) return;

        const guess = highlowResult.content ?? "1";
        const isExact = secretNumber == higherLowerNumber;
        const correctGuessPrize = rand.intBetween(1000, 3000);
        const footer = this.language.execution.footer;
        const winText = `${this.language.execution.win_text}\n${footer}`;
        // TODO: add weighted random ranges

        const placeholder = {
            placeholder: {
                custom: {
                    number: higherLowerNumber.toString(),
                    secretNumber: secretNumber.toString(),
                    tag: `@${user.phone}`,
                    prize: commas(correctGuessPrize),
                },
            },
        };
        if ((guess === "1" && isHigher) || (guess === "2" && !isHigher)) {
            await this.addBalance(user, {wallet: correctGuessPrize});
            await message.replyAdvanced({text: winText, mentions: [user.jid]}, true, placeholder);
            return;
        } else if (guess === "3" && isExact) {
            const jackpotPrize = rand.intBetween(150000, 300000);
            const reply = `${this.language.execution.jackpot_text}\n${footer}`;
            await this.addBalance(user, {wallet: jackpotPrize});
            placeholder.placeholder.custom.prize = commas(jackpotPrize);
            await message.replyAdvanced({text: reply, mentions: [user.jid]}, true, placeholder);
            return;
        }

        const lossText = `${this.language.execution.lose_text}\n${footer}`;
        await message.replyAdvanced({text: lossText, mentions: [user.jid]}, true, placeholder);
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
