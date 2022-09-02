import { WASocket} from "@adiwajshing/baileys";
import moment from "moment";
import {CommandTrigger, EconomyCommand} from "../..";
import {BlockedReason} from "../../../blockable";
import languages from "../../../config/language.json";
import Message from "../../../messaging/message";
import {Chat, User} from "../../../db/types";
import {prisma} from "../../../db/client";
import {pluralForm} from "../../../utils/message_utils";
import {commas} from "../../../utils/utils";
import {AccountType} from "@prisma/client";

export default class WeeklyCommand extends EconomyCommand {
    private language: typeof languages.commands.weekly[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.weekly;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
            usage: lang.usage,
            cooldowns: new Map([
                [AccountType.USER, 30 * 1000],
                [AccountType.DONOR, 30 * 1000],
                [AccountType.SPONSOR, 30 * 1000],
            ]),
            accountType: "DONOR",
            groupAccountType: "SPONSOR",
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
        const weeklies = user.weeklies;
        const lastWeeklyRaw = weeklies[weeklies.length - 1];
        const lastWeekly = lastWeeklyRaw ? moment(lastWeeklyRaw).utc() : undefined;
        const firstOfNextWeek = moment().utc().add(1, "week").startOf("week");

        if (lastWeekly && lastWeekly.isSame(moment().utc(), "week")) {
            return await message.reply(this.language.execution.claimed, true, {
                placeholder: {
                    custom: {
                        date: firstOfNextWeek.format("DD/MM/YYYY"),
                    },
                },
            });
        }

        const reward = 275_000;
        await this.addBalance(user, {wallet: reward});
        const reply =
            this.language.execution.success_title + "\n\n" + this.language.execution.success;
        await prisma.user.update({
            where: {jid: user.jid},
            data: {
                weeklies: {
                    push: moment().utc().toDate(),
                },
            },
        });

        return await message.replyAdvanced({text: reply, mentions: [user.jid]}, true, {
            placeholder: {
                custom: {
                    tag: `@${user.phone}`,
                    coins: commas(reward), // amount placed
                    coin: pluralForm(reward, languages.economy.coin[this.langCode]), // coin word translation
                    date: firstOfNextWeek.format("DD/MM/YYYY"),
                },
            },
        });
    }

    async onBlocked(data: Message, blockedReason: BlockedReason, chat: Chat) {
        if (blockedReason == BlockedReason.BadAccountType) {
            await data.reply(languages.not_donor[this.langCode], true, {
                placeholder: {
                    chat
                }
            });
        }
    }
}
