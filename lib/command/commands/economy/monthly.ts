import {jidDecode, WASocket} from "@adiwajshing/baileys";
import moment from "moment";
import {CommandTrigger, EconomyCommand} from "../..";
import {BlockedReason} from "../../../blockable";
import languages from "../../../config/language.json";
import {RandomSeed} from "random-seed";
import {weightedReward} from "./utils";
import Message from "../../../messaging/message";
import {Chat, User} from "../../../db/types";
import {prisma} from "../../../db/client";
import { pluralForm } from "../../../utils/message_utils";
import { getUserRandom } from "../../../user/user";
import { commas } from "../../../utils/utils";
import { AccountType } from "@prisma/client";

export default class MonthlyCommand extends EconomyCommand {
    private language: typeof languages.commands.monthly[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.monthly;
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
        const monthlies = user.monthlies;
        const lastMonthlyRaw = monthlies[monthlies.length - 1];
        const lastMonthly = lastMonthlyRaw ? moment(lastMonthlyRaw).utc() : undefined;
        const firstOfNextMonth = moment().utc().add(1, "month").startOf("month");

        if (lastMonthly && lastMonthly.isSame(moment().utc(), "month")) {
            return await message.reply( this.language.execution.claimed, true, {
                placeholder: {
                    custom: new Map([["date", firstOfNextMonth.format('DD/MM/YYYY')]]),
                },
            });
        }


        const reward = 1_000_000;
        await this.addBalance(user, {wallet: reward});
        const reply =
            this.language.execution.success_title + "\n\n" + this.language.execution.success;
        await prisma.user.update({
            where: {jid: user.jid},
            data: {
                monthlies: {
                    push: moment().utc().toDate(),
                }
            }
        })

        return await message.replyAdvanced(
            {text: reply, mentions: [user.jid]},
            true,
            {
                placeholder: {
                    custom: {
                        tag: `@${user.phone}`,
                        coins: commas(reward), // amount placed
                        coin: pluralForm(reward, languages.economy.coin[this.langCode]), // coin word translation
                        date: firstOfNextMonth.format('DD/MM/YYYY'),
                    },
                },
            },
        );
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
