import {prisma} from "../db/client";
import config from "../config/config.json";
import items from "../config/items.json";
import {AccountType, Money, Prisma, User} from "@prisma/client";
import crypto from "crypto";
import {create as createRandom} from "random-seed";
import {CommandTrigger, Command} from "../command";
import {getNumberFromAccountType} from "../utils/utils";


export const userCalculateNetBalance = async (
    user: Prisma.UserGetPayload<{
        include: {
            items: true;
            money: true;
        };
    }>,
) => {
    let userMoney = user.money;
    if (!user.money) {
        userMoney = await prisma.money.create({
            data: {
                bank: 0,
                bankCapacity: config.bank_start_capacity,
                wallet: 0,
                user: {connect: {jid: user.jid}},
            },
        });
    }

    if (!userMoney) {
        return 0;
    }

    return (
        userMoney.bank +
        userMoney.wallet +
        user.items.reduce((acc, {quantity, itemId}) => {
            const item = items.find((e) => e.id === itemId);
            return acc + (item?.buy ?? 0) * quantity;
        }, 0)
    );
};

export const getUserMoney = async (user: User & {money: Money | null | undefined}) => {
    if (user.money) return user.money;

    return await prisma.money
        .create({
            data: {
                bank: 0,
                bankCapacity: config.bank_start_capacity,
                wallet: 0,
                user: {connect: {jid: user.jid}},
            },
        })
        .catch((err) => undefined);
};

export const getCooldownLeft = (
    user: Prisma.UserGetPayload<{
        include: {
            cooldowns: true;
        };
    }>,
    trigger: CommandTrigger,
) => {
    const cooldown = user.cooldowns.find((c) => trigger.isTriggered(c.cooldownOn));
    const now = Date.now();
    const cooldownLeft = Math.max(0, (cooldown?.expiresAt?.getTime() ?? now) - now);
    return cooldownLeft;
};

export const addCooldownToUser = async (user: User, cooldownOn: string, cooldown: number) => {
    const expiresAt = new Date(Date.now() + cooldown);
    await prisma.cooldown.create({
        data: {
            cooldownOn,
            expiresAt,
            user: {connect: {jid: user.jid}},
        },
    });
};

export const addCommandCooldown = async (user: User, command: Command) => {
    let cooldown = command.cooldowns.get(user.accountType);
    if (!cooldown) {
        let accountLevel = getNumberFromAccountType(user.accountType);
        const accounts = Object.keys(AccountType) as (keyof typeof AccountType)[];
        while (accountLevel >= 0 && !cooldown) {
            accountLevel--;
            cooldown = command.cooldowns.get(accounts[accountLevel]);
        }
    }

    if (cooldown == 0 || cooldown === undefined) return;
    const expiresAt = new Date(Date.now() + cooldown);
    await prisma.cooldown.create({
        data: {
            cooldownOn: command.mainTrigger.command,
            expiresAt,
            user: {connect: {jid: user.jid}},
        },
    });
};

export const getUserRandom = (user: User) => {
    return createRandom(generateSeedFromUser(user));
};

const generateSeedFromUser = (user: User) => {
    // generate a hash seed based on user using crypto
    const hash = crypto.createHash("sha256");
    hash.update(user.jid + user.name + user.createdAt.toISOString() + Date.now().toString());
    return hash.digest("hex");
};
