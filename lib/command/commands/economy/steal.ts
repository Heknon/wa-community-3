import EconomyCommand from "../../economy_command";
import languages from "../../../config/language.json";
import {BlockedReason} from "../../../blockable";
import {WASocket} from "@adiwajshing/baileys";
import CommandTrigger from "../../command_trigger";
import {AccountType} from "@prisma/client";
import Message from "../../../messaging/message";
import {Chat, User} from "../../../db/types";
import {getFullUser} from "../../../user/database_interactions";
import {weightedChoice, weightedReward} from "./utils";
import {getUserRandom} from "../../../user/user";
import {commas} from "../../../utils/utils";
import {pluralForm} from "../../../utils/message_utils";
import {prisma} from "../../../db/client";

type Theft = {
    odds: number;
    id: string;
    amounts: [number, [number, number]][];
    max?: number;
};

export default class StealCommand extends EconomyCommand {
    private language: typeof languages.commands.steal[Language];
    private langCode: Language;
    private caughtOdds = languages.commands.steal.caught;
    private thefts: Theft[] = languages.commands.steal.thefts as Theft[];

    constructor(language: Language) {
        const langs = languages.commands.steal;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
            usage: lang.usage,
            cooldowns: new Map([
                [AccountType.USER, 30 * 60 * 1000],
                [AccountType.DONOR, 25 * 60 * 1000],
                [AccountType.SPONSOR, 22 * 60 * 1000],
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
        if (message.mentions.length === 0) {
            return message.reply(this.language.execution.no_user, true);
        }

        const target = message.mentions.find((e) => e != user.jid);
        if (!target) {
            return message.reply(this.language.execution.self_tag, true);
        }

        const minWalletForSteal = 5000;
        if (!user.money || user.money.wallet < minWalletForSteal) {
            return message.reply(this.language.execution.not_enough_money_self, true);
        }

        const targetUser = await getFullUser(target);
        if (!targetUser || !targetUser.money || targetUser.money.wallet < minWalletForSteal) {
            return message.reply(this.language.execution.not_enough_money, true);
        }

        const random = getUserRandom(user);

        const caught = weightedChoice([
            [true, this.caughtOdds],
            [false, 1 - this.caughtOdds],
        ]);
        if (caught) {
            const paid = Math.min(
                2000 + random.intBetween(0, 500),
                weightedReward(random, [
                    [[0.05, 0.1], 0.4],
                    [[0.2, 0.45], 0.1],
                    [[0.1, 0.25], 0.5],
                ]) * user.money.wallet,
            );

            const fakeid = user.activeItems.find((e) => e.id === "fakeid");
            if (fakeid)
                await prisma.activeItem.delete({
                    where: {
                        id: fakeid.id,
                    },
                });
            return message.reply(this.language.execution.caught, true, {
                placeholder: {
                    custom: {
                        tag: "@" + targetUser.phone,
                        coins: commas(paid),
                        coin: pluralForm(paid, languages.economy.coin[this.langCode]),
                    },
                },
            });
        }

        const chosenTheftType = weightedChoice(this.thefts.map((e) => [e.id, e.odds]));
        const theft = this.thefts.find((e) => e.id === chosenTheftType)!;
        const max = Math.min(targetUser.money.wallet, theft.max ?? targetUser.money.wallet);
        const amountStolen =
            weightedReward(
                random,
                theft.amounts.map((e) => [e[1], e[0]]),
            ) * max;

        const takeMessage = this.language.execution.take_messsages[theft.id]!;
        const successMessage = `${takeMessage}\n${this.language.execution.success_footer}`;
        await this.addBalance(user, {wallet: amountStolen});
        await this.removeBalance(targetUser, {wallet: amountStolen});
        await message.reply(successMessage, true, {
            placeholder: {
                custom: {
                    coins: commas(amountStolen),
                    coin: pluralForm(amountStolen, languages.economy.coin[this.langCode]),
                },
            },
        });
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
