import EconomyCommand from "../../economy_command";
import languages from "../../../config/language.json";
import {BlockedReason} from "../../../blockable";
import {S_WHATSAPP_NET, WASocket} from "@adiwajshing/baileys";
import CommandTrigger from "../../command_trigger";
import {AccountType} from "@prisma/client";
import Message from "../../../messaging/message";
import {Chat, User} from "../../../db/types";
import {getFullUser} from "../../../user/database_interactions";
import {weightedChoice, weightedReward} from "./utils";
import {getUserRandom, userDoDeath} from "../../../user/user";
import {commas} from "../../../utils/utils";
import {pluralForm} from "../../../utils/message_utils";
import {prisma} from "../../../db/client";
import moment from "moment";
import "moment-duration-format";
import { rescueNumbers } from "../../../utils/regex_utils";
import { logger } from "../../../logger";

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
            blockedChats: ['DM']
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
        if (user.passive) {
            message.reply(this.language.execution.passive, true);
            return false;
        }

        const numbers = rescueNumbers(body).map(e => e + S_WHATSAPP_NET);
        if (message.mentions.length === 0 && numbers.length === 0) {
            message.reply(this.language.execution.no_user, true);
            return false;
        }

        const sandbox = user.activeItems.find(
            (e) => e.itemId === "sandbox" && (e.expire ?? Date.now() + 1000) > Date.now(),
        );

        if (sandbox) {
            message.reply(this.language.execution.sandbox, true, {
                placeholder: {
                    custom: {
                        time: sandbox.expire
                            ? moment
                                  .duration(sandbox.expire.getTime() - Date.now())
                                  .format("d[d] h[h] m[m] s[s]")
                            : "NEVER",
                    },
                },
            });
            return false;
        }

        const target = message.mentions.find((e) => e != user.jid) || numbers.find((e) => e != user.jid);
        if (!target) {
            await message.reply(this.language.execution.self_tag, true);
            return false;
        }
        const meta = await client.groupMetadata(chat.jid);
        if (meta.participants.findIndex((e) => e.id === target) === -1) {
            await message.reply(this.language.execution.not_in_group, true);
            return false;
        }

        const minWalletForSteal = 5000;
        if (!user.money || user.money.wallet < minWalletForSteal) {
            await message.reply(this.language.execution.not_enough_money_self, true);
            return false;
        }

        const targetUser = await getFullUser(target);
        if (!targetUser || !targetUser.money || targetUser.money.wallet < minWalletForSteal) {
            await message.reply(this.language.execution.not_enough_money, true);
            return false;
        }

        if (targetUser.passive) {
            await message.reply(this.language.execution.target_passive, true);
            return false;
        }

        const landmine = targetUser.activeItems.find(
            (e) => e.itemId === "landmine" && (e.expire ?? Date.now() + 1000) > Date.now(),
        );
        const padlock = targetUser.activeItems.find(
            (e) => e.itemId === "padlock" && (e.expire ?? Date.now() + 1000) > Date.now(),
        );

        const random = getUserRandom(user);

        if (landmine && random.intBetween(0, 100) < 50) {
            await prisma.activeItem.delete({
                where: {
                    id: landmine.id,
                },
            });
            await message.reply(this.language.execution.blewup, true);
            return await userDoDeath(chat, user, message);
        }

        const caughtOdds = this.caughtOdds + (padlock ? 0.15 : 0);
        const caught = weightedChoice([
            [true, caughtOdds],
            [false, 1 - caughtOdds],
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

            const fakeid = user.activeItems.find((e) => e.itemId === "fakeid");
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
                tags: [targetUser.jid],
            });
        } else if (padlock) {
            const padlockBreakOdds = 0.01;
            const brokePadlock = weightedChoice([
                [true, padlockBreakOdds],
                [false, 1 - padlockBreakOdds],
            ]);

            logger.debug(`Breaking padlock `, JSON.stringify(padlock, null, 2));
            await prisma.activeItem.delete({
                where: {
                    id: padlock.id,
                },
            });

            if (brokePadlock) {
                message.reply(this.language.execution.padlock_broke, true);
            } else {
                return message.reply(this.language.execution.padlock, true, {
                    placeholder: {
                        custom: {
                            tag: "@" + targetUser.phone,
                        },
                    },
                    tags: [targetUser.jid],
                });
            }
        }

        const chosenTheftType = weightedChoice(this.thefts.map((e) => [e.id, e.odds]));
        const theft = this.thefts.find((e) => e.id === chosenTheftType)!;
        let max = Math.min(targetUser.money.wallet, theft.max ?? targetUser.money.wallet);
        if (padlock) max = max * 0.6;
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
