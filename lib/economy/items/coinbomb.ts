import {Chat, User} from "../../db/types";
import Message from "../../messaging/message";
import Item from "./item";
import languages from "../../config/language.json";
import {pluralForm, waitForMessage} from "../../utils/message_utils";
import {getUserRandom} from "../../user/user";
import {weightedReward} from "../../command/commands/economy/utils";
import {commas} from "../../utils/utils";
import {prisma} from "../../db/client";

export class CoinBomb extends Item {
    private static language = languages.items["coinbomb"];

    public async use(chat: Chat, executor: User, message?: Message | undefined) {
        const random = getUserRandom(executor);
        const coinsRewardAmount = weightedReward(random, [
            [[2000, 5000], 0.1],
            [[6000, 8000], 0.2],
            [[8000, 12000], 0.3],
            [[10000, 15000], 0.4],
        ]);
        let coinsLeft = coinsRewardAmount;

        await message?.replyAdvanced(
            {text: CoinBomb.language[chat.language], mentions: [executor.jid]},
            true,
            {
                placeholder: {
                    custom: {
                        tag: "@" + executor.phone,
                    },
                },
            },
        );
        waitForMessage(async (msg) => {
            if (msg.jid !== message?.jid) {
                return false;
            }

            if (coinsRewardAmount <= 0) {
                message?.reply(CoinBomb.language.ended[chat.language], true, {
                    placeholder: {
                        custom: {
                            collected: commas(coinsRewardAmount - coinsLeft),
                            total: commas(coinsRewardAmount),
                            coins: pluralForm(
                                coinsRewardAmount - coinsLeft,
                                languages.economy.coin[chat.language],
                            ),
                            coins_total: pluralForm(
                                coinsRewardAmount,
                                languages.economy.coin[chat.language],
                            ),
                        },
                    },
                });
                return true;
            }
            if (msg.fromBot) {
                return false;
            }
            if (msg.senderJid === executor.jid && msg.mentions.includes(executor.jid)) {
                message?.reply(CoinBomb.language.greed[chat.language], true);
                return false;
            }

            if (!msg.mentions.includes(executor.jid)) return false;

            let coinsToGive = Math.floor(
                weightedReward(random, [
                    [[0.05, 0.1], 0.2],
                    [[0.01, 0.05], 0.1],
                    [[0.1, 0.2], 0.4],
                    [[0.15, 0.2], 0.2],
                ]) * coinsRewardAmount,
            );
            coinsToGive = coinsLeft >= 1000 ? Math.min(coinsToGive, coinsLeft) : coinsLeft;
            coinsLeft -= coinsToGive;
            await prisma.money.update({
                where: {id: executor.money?.id!},
                data: {
                    wallet: {
                        increment: coinsToGive,
                    },
                },
            });
            msg.reply(CoinBomb.language.success[chat.language], true, {
                placeholder: {
                    custom: {
                        amount: commas(coinsToGive),
                        coins: pluralForm(coinsToGive, languages.economy.coin[chat.language]),
                    },
                },
            });

            return false;
        }, 60 * 1000).catch((res) => {
            message?.reply(CoinBomb.language.ended[chat.language], true, {
                placeholder: {
                    custom: {
                        collected: commas(coinsRewardAmount - coinsLeft),
                        total: commas(coinsRewardAmount),
                        coins: pluralForm(
                            coinsRewardAmount - coinsLeft,
                            languages.economy.coin[chat.language],
                        ),
                        coins_total: pluralForm(
                            coinsRewardAmount,
                            languages.economy.coin[chat.language],
                        ),
                    },
                },
            });
        });
        return true;
    }
}
