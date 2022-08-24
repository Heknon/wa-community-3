import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {CommandTrigger, EconomyCommand} from "../..";
import {BlockedReason} from "../../../blockable";
import {commas} from "../../../utils/utils";
import languages from "../../../config/language.json";
import {pluralForm} from "../../../utils/message_utils";
import {weightedChoice, weightedReward} from "./utils";
import {RandomSeed} from "random-seed";
import {AccountType} from "@prisma/client";
import Message from "../../../messaging/message";
import {Chat, User} from "../../../db/types";
import {getUserRandom} from "../../../user/user";

type Crime =
    | "vandalism"
    | "shop lifting"
    | "drug distribution"
    | "tax evasion"
    | "arson"
    | "murder"
    | "cyber bullying"
    | "fraud"
    | "identity theft";

export default class CrimeCommand extends EconomyCommand {
    private language: typeof languages.commands.crime[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.crime;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
            cooldowns: new Map([
                [AccountType.USER, 45 * 1000],
                [AccountType.DONOR, 20 * 1000],
                [AccountType.SPONSOR, 15 * 1000],
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
        const getCoinText = (number: number) =>
            pluralForm(number, languages.economy.coin[this.langCode]);
        const placeholder = this.getDefaultPlaceholder({chat, message, user});

        // pick a crime
        const rand = getUserRandom(user);
        const chosenIndices = new Set();
        const crimes = [undefined, undefined, undefined].map((e) => {
            let chosenIndex = rand.intBetween(0, this.language.execution.crimes.length - 1);
            while (chosenIndices.has(chosenIndex)) {
                chosenIndex = rand.intBetween(0, this.language.execution.crimes.length - 1);
            }
            chosenIndices.add(chosenIndex);
            return this.language.execution.crimes[chosenIndex];
        });

        const crimesToPickText = crimes.map((crime, i) => `${i + 1}. ${crime.name}`).join("\n");
        const pickACrimeText = `${this.language.execution.pick_crime}\n\n${crimesToPickText}`;

        await message.reply(pickACrimeText, true, {placeholder});
        const crimeChosenMessage = await this.validatedWaitForInteractionWith(
            message,
            (msg) => msg.reply(pickACrimeText, true, {placeholder}),
            20 * 1000,
            () =>
                message.replyAdvanced(
                    {text: this.language.execution.didnt_choose_crime, mentions: [user.jid]},
                    true,
                    {placeholder},
                ),
            "1",
            "2",
            "3",
            ...crimes.map((e) => e.name),
        );

        if (!crimeChosenMessage) return;
        const crimeChosenBody = crimeChosenMessage.content?.trim();
        if (!crimeChosenMessage || !crimeChosenBody) return;

        const crimeChosen = parseInt(crimeChosenBody)
            ? parseInt(crimeChosenBody) - 1
            : crimes.findIndex((e) => e.name === crimeChosenBody);
        const crime = crimes[crimeChosen];
        if (!crime) return;

        let crimeResultMessage = this.language.execution.commited + "\n\n";
        const crimeSuccess = weightedChoice([
            [true, crime.success_chance],
            [false, 1 - crime.success_chance],
        ]);
        const crimeDeath = weightedChoice([
            [true, crime.death_chance],
            [false, 1 - crime.death_chance],
        ]);
        const reward = this.getReward(rand);

        if (crimeSuccess) {
            crimeResultMessage += crime.success;
            await this.addBalance(user, {wallet: reward});
        } else if (!crimeDeath && !crimeSuccess) {
            crimeResultMessage += crime.failed;
        }

        if (crimeDeath) {
            crimeResultMessage += crime.death;
            crimeChosenMessage.reply(
                this.language.execution.death_not_implemented,
                true,
                {
                    privateReply: true,
                    placeholder,
                },
            );
        }

        if (crimeDeath || !crimeSuccess) {
            crimeResultMessage += "\n\n" + this.language.execution.failed_crime_footer;
        }

        return await crimeChosenMessage.replyAdvanced(
            {text: crimeResultMessage, mentions: [user.jid]},
            true,
            {
                placeholder: this.addCustomPlaceholders(placeholder, {
                    amount: commas(reward),
                    crime: crime.name,
                    coin: getCoinText(reward),
                }),
            },
        );
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}

    private getReward(random: RandomSeed) {
        return weightedReward(random, [
            [[3000, 3500], 10], // 10% chance of getting reward between 3000 and 3500
            [[2500, 3000], 30], // 30% chance of getting reward between 2500 and 3000
            [[2000, 2500], 50],
            [[1000, 1500], 10],
        ]);
    }
}
