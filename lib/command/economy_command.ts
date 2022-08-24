import {Money, Prisma, User} from "@prisma/client";
import InteractableCommand from "./interactable_command";
import {prisma} from "../db/client";
import config from "../config/config.json";

export type Balance = {wallet?: number; bank?: number};

export default abstract class EconomyCommand extends InteractableCommand {
    public async setBalance(
        user: Prisma.UserGetPayload<{
            include: {
                money: true;
            };
        }>,
        balance: Balance,
    ): Promise<Money | undefined> {
        // enforce bank capacity
        const capacity = user.money?.bankCapacity ?? config.bank_start_capacity
        const bank = Math.min(
            capacity,
            balance?.bank ?? 0,
        );
        const leftOutOfBank = (balance.bank ?? 0) - bank;
        const wallet = balance.wallet ?? 0 + leftOutOfBank;

        console.log("set to", {
            wallet,
            bank,
        });
        const update = await prisma.money
            .upsert({
                where: {
                    userJid: user.jid,
                },
                update: {
                    wallet,
                    bank,
                },
                create: {
                    bank,
                    wallet,
                    bankCapacity: config.bank_start_capacity,
                    user: {connect: {jid: user.jid}},
                },
            })
            .catch((err) => undefined);

        return update;
    }

    public async addBalance(
        user: Prisma.UserGetPayload<{
            include: {
                money: true;
            };
        }>,
        balance: Balance,
    ) {
        console.log("setting balance", {
            wallet: (user.money?.wallet ?? 0) + (balance.wallet ?? 0),
            bank: (user.money?.bank ?? 0) + (balance.bank ?? 0),
        });
        return this.setBalance(user, {
            wallet: (user.money?.wallet ?? 0) + (balance.wallet ?? 0),
            bank: (user.money?.bank ?? 0) + (balance.bank ?? 0),
        });
    }

    public async removeBalance(
        user: Prisma.UserGetPayload<{
            include: {
                money: true;
            };
        }>,
        balance: Balance,
    ) {
        return this.addBalance(user, {wallet: -(balance.wallet ?? 0), bank: -(balance.bank ?? 0)});
    }
}
