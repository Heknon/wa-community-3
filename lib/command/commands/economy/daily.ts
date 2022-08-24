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

export default class DailyCommand extends EconomyCommand {
    private language: typeof languages.commands.daily[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.daily;
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
        const daily =
            user.daily ??
            (await prisma.dailyReward.create({
                data: {
                    streak: 0,
                    lastDaily: new Date(0),
                    user: {connect: {jid: user.jid}},
                },
            }));
        let dailyStreak = daily.streak;
        const lastDaily = moment(daily.lastDaily.toISOString()).utc();
        // allow only one daily per day - day resets at UTC midnight
        const timeTillNextUTCMidnight = moment
            .utc()
            .add(1, "day")
            .startOf("day")
            .diff(moment().utc(), "seconds");
        // format timeTillUTCMidnight to x hour, x minutes and x seconds and if hour or minute is 0, remove it
        const timeTillUTCMidnightMoment = moment.unix(timeTillNextUTCMidnight).utc();
        const hours = timeTillUTCMidnightMoment.hours();
        const minutes = timeTillUTCMidnightMoment.minutes();
        const seconds = timeTillUTCMidnightMoment.seconds();
        const timeTillUTCMidnightFormatted = `${
            hours > 0 ? `${hours} ${pluralForm(hours, languages.times[this.langCode].hour)}, ` : ""
        }${seconds <= 0 && hours > 0 ? this.language.execution.and : ""}${
            minutes > 0
                ? `${minutes} ${pluralForm(hours, languages.times[this.langCode].minute)} `
                : ""
        }${
            seconds > 0
                ? `${minutes > 0 ? this.language.execution.and : ""}${seconds} ${pluralForm(
                      hours,
                      languages.times[this.langCode].second,
                  )}`
                : ""
        }`;

        if (lastDaily.isSame(moment().utc(), "day")) {
            return await message.reply( this.language.execution.claimed, true, {
                placeholder: {
                    custom: new Map([["text", timeTillUTCMidnightFormatted]]),
                },
            });
        }

        // if last time daily was done is before start of current day, reset streak
        const isStreakBroken =
            dailyStreak > 0 && lastDaily.isBefore(moment().utc().subtract(1, "day").startOf("day"));
        if (isStreakBroken) dailyStreak = 1;
        else dailyStreak++;

        const rand = getUserRandom(user);
        const streakBonus = !isStreakBroken
            ? dailyStreak * this.getStreakReward(rand, dailyStreak)
            : 0;
        const dailyCoins = this.getDailyReward(rand) + streakBonus;
        await this.addBalance(user, {wallet: dailyCoins});

        const dailyCoinsWithCommas = commas(dailyCoins);
        const streakCoinsWithCommas = commas(streakBonus);

        const reply =
            this.language.execution.success_title + "\n\n" + this.language.execution.success;
        await prisma.dailyReward.update({
            where: {id: daily.id},
            data: {
                lastDaily: new Date(),
                streak: dailyStreak,
            }
        })

        return await message.replyAdvanced(
            {text: reply, mentions: [user.jid]},
            true,
            {
                placeholder: {
                    custom: {
                        tag: `@${user.phone}`,
                        coins: dailyCoinsWithCommas, // amount placed
                        coin: pluralForm(dailyCoins, languages.economy.coin[this.langCode]), // coin word translation
                        text: timeTillUTCMidnightFormatted, // time till next daily
                        streak: commas(dailyStreak), // days of unbroken streak
                        days: pluralForm(dailyStreak, languages.times[this.langCode].day), // days word translation
                        bonus: streakCoinsWithCommas, // streak bonus
                    },
                },
            },
        );
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}

    private getStreakReward(random: RandomSeed, streak: number) {
        return (
            Math.min(streak, 150) *
            weightedReward(random, [
                [[500, 1000], 94], // 94% chance of getting reward between 500 and 1000
                [[1300, 1600], 3],
                [[300, 600], 3], // unlucky
            ])
        );
    }

    private getDailyReward(random: RandomSeed) {
        return weightedReward(random, [
            [[2000, 5000], 10],
            [[5000, 10000], 20],
            [[7500, 15000], 27],
            [[12000, 20000], 35],
            [[20000, 30000], 5],
            [[25000, 30000], 3],
            [[50000, 70000], 0.001],
        ]);
    }
}
