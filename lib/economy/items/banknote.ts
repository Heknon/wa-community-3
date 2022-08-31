import {Chat, User} from "../../db/types";
import Message from "../../messaging/message";
import Item from "./item";
import languages from "../../config/language.json";
import {prisma} from "../../db/client";
import {getUserRandom} from "../../user/user";
import {weightedReward} from "../../command/commands/economy/utils";
import {commas} from "../../utils/utils";
import { pluralForm } from "../../utils/message_utils";

export class BankNote extends Item {
    private static language = languages.items["banknote"];

    public async use(chat: Chat, executor: User, message?: Message | undefined) {
        const random = getUserRandom(executor);
        const amount = weightedReward(random, [
            [[40 * 1000, 55 * 1000], 30],
            [[60 * 1000, 80 * 1000], 30],
            [[55 * 1000, 70 * 1000], 40],
        ]);

        const updated = await prisma.money.update({
            where: {id: executor.money?.id!},
            data: {
                bankCapacity: (executor.money?.bankCapacity ?? 0) + amount,
                banknotes: (executor.money?.banknotes ?? 0) + amount,
            },
        });

        await message?.reply(BankNote.language[chat.language], true, {
            placeholder: {
                chat,
                user: executor,
                custom: {
                    expanded: commas(amount),
                    total_expanded: commas(updated.banknotes),
                    total: commas(updated.bankCapacity),
                    coins: pluralForm(amount, languages.economy.coin[chat.language]),
                },
            },
        });

        return true;
    }
}
