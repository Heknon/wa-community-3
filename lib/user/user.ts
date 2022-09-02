import {prisma, redisCooldown} from "../db/client";
import config from "../config/config.json";
import items from "../config/items.json";
import {AccountType, Chat, InventoryItem, Money, Prisma, User} from "@prisma/client";
import {User as FullUser, Chat as FullChat} from "../db/types";
import crypto from "crypto";
import {create as createRandom, RandomSeed} from "random-seed";
import {CommandTrigger, Command} from "../command";
import {commas, getNumberFromAccountType} from "../utils/utils";
import getItem, {getItemData} from "../economy/items";
import {Lifesaver} from "../economy/items/lifesaver";
import Message from "../messaging/message";
import {getInventory, userRegisterItemUse} from "./inventory";
import {weightedChoice, weightedReward} from "../command/commands/economy/utils";
import {Rarity, RarityKey} from "../economy/rarity";
import {hasActiveItemExpired, rarityToNumber} from "../economy/utils";
import {Apple} from "../economy/items/apple";
import language from "../config/language.json";
import {pluralForm} from "../utils/message_utils";
import moment from "moment";

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

export const getCooldownLeft = async (jid: string, trigger: CommandTrigger) => {
    // const cooldown = user.cooldowns.find((c) => trigger.isTriggered(c.cooldownOn));
    const cooldownRaw = await redisCooldown.get(
        getCooldownRedisKey(jid, trigger.command.toLowerCase().trim()),
    );
    const cooldownExpiresAt = cooldownRaw ? new Date(cooldownRaw) : undefined;
    const now = Date.now();
    const cooldownLeft = Math.max(0, (new Date(cooldownExpiresAt ?? now)?.getTime() ?? now) - now);
    return cooldownLeft;
};

export const addCooldownToUser = async (jid: string, cooldownOn: string, cooldown: number) => {
    const expiresAt = new Date(Date.now() + cooldown);
    const formattedCooldownOn = cooldownOn.toLowerCase().trim();
    return await redisCooldown.set(
        getCooldownRedisKey(jid, formattedCooldownOn),
        expiresAt.toISOString(),
    );
};

export const removeCooldownFromUser = async (jid: string, cooldownOn: string) => {
    const formattedCooldownOn = cooldownOn.toLowerCase().trim();
    return await redisCooldown.del(getCooldownRedisKey(jid, formattedCooldownOn));
};

export const addCommandCooldown = async (user: Prisma.UserGetPayload<{}>, command: Command) => {
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
    await addCooldownToUser(user.jid, command.mainTrigger.command, cooldown);
};

export const removeCommandCooldown = async (user: Prisma.UserGetPayload<{}>, command: Command) => {
    await removeCooldownFromUser(user.jid, command.mainTrigger.command);
};

export const getCooldownRedisKey = (id: string, cooldownOn: string) => {
    return `${id}:${cooldownOn}`;
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

const calculateUserMoneyPercentile = async (
    user: Prisma.UserGetPayload<{include: {money: true}}>,
) => {
    const balances = (await prisma.money.findMany({})).map((e) => {
        return {
            total: e.bank + e.wallet,
            bank: e.bank,
            wallet: e.wallet,
        };
    });

    // calculate the percentile of the user's balance
    const userBalance = {
        total: (user.money?.bank ?? 0) + (user.money?.wallet ?? 0),
        bank: user.money?.bank ?? 0,
        wallet: user.money?.wallet ?? 0,
    };
};

export const userDoDeath = async (chat: FullChat, user: FullUser, message: Message) => {
    if (
        user.deaths.length === 0 ||
        moment(user.deaths[user.deaths.length - 1]).isBefore(moment().subtract(6, "month"))
    ) {
        await message.reply(language.death.warning[chat.language]);
        await prisma.user.update({
            where: {
                jid: user.jid,
            },
            data: {
                deaths: {
                    push: [new Date()],
                },
            },
        });
        return;
    }

    const hasLifesaver = user.items.some((e) => e.itemId === "lifesaver" && e.quantity > 0);
    const activeApple = user.activeItems.find((e) =>
        e.itemId === "apple" && !hasActiveItemExpired(e),
    );

    if (hasLifesaver) {
        const lifesaverItem = getItem("lifesaver") as Lifesaver;
        await lifesaverItem?.use(chat, user, message);
        await userRegisterItemUse(user, lifesaverItem);
        return;
    }

    let lostItems: ItemLoss[] = [];
    let appleSavedInventory = false;
    if (!activeApple) {
        await prisma.activeItem.deleteMany({
            where: {
                userJid: user.jid,
            },
        });

        const itemsToGo = getItemsLostOnDeath(user);
        lostItems = itemsToGo;
        await prisma.inventoryItem.deleteMany({
            where: {
                id: {in: itemsToGo.map((e) => e.id)},
            },
        });
    } else if (activeApple.id) {
        await prisma.activeItem.delete({
            where: {
                id: activeApple.id,
            },
        });

        appleSavedInventory = true;
    }

    const random = getUserRandom(user);
    const moneyLost = Math.floor((user.money?.wallet ?? 0) * (random.intBetween(50, 100) / 100));
    await prisma.money.update({
        where: {
            id: user.money?.id,
        },
        data: {
            wallet: moneyLost,
        },
    });

    const itemsLost = lostItems
        .map((e) => {
            return language.death.itemloss[chat.language]
                .replace("{item}", getItemData(e.itemId)!.name[chat.language])
                .replace("{quantity}", commas(e.quantity));
        })
        .join("\n");
    const itemsLostMessage =
        lostItems.length === 0 ? language.death.noloss[chat.language] : itemsLost;
    await message.replyAdvanced(
        {
            text: language.death[chat.language],
            mentions: [user.jid],
        },
        true,
        {
            placeholder: {
                custom: {
                    tag: "@" + user.phone,
                    balance: commas(moneyLost),
                    coins: pluralForm(
                        moneyLost,
                        language.economy.coin[chat.language],
                    ),
                    items: itemsLostMessage,
                },
            },
        },
    );
};

type ItemLoss = {
    itemId: string;
    quantity: number;
    id: string;
};

const getItemsLostOnDeath = (user: FullUser): ItemLoss[] => {
    const random = getUserRandom(user);

    const maxItemRarityGone = weightedChoice([
        [rarityToNumber(Rarity.EPIC), 0.05],
        [rarityToNumber(Rarity.RARE), 0.35],
        [rarityToNumber(Rarity.COMMON), 0.6],
    ]);
    const itemsCanGo: InventoryItem[] = getInventory(user).filter(
        (e) => rarityToNumber(e.item?.rarity.toUpperCase() as RarityKey) <= maxItemRarityGone,
    );

    const amountToGo = weightedChoice([
        [0, 0.2],
        [1, 0.55],
        [2, 0.2],
        [3, 0.05],
    ]);

    const idsAdded = new Set<string>();
    const itemsToGo = Array(amountToGo)
        .fill(0)
        .map(() => {
            let index = random.intBetween(0, itemsCanGo.length - 1);
            let item = itemsCanGo[index];
            while (idsAdded.has(item.id) && idsAdded.size < itemsCanGo.length) {
                index = random.intBetween(0, itemsCanGo.length - 1);
                item = itemsCanGo[index];
            }

            if (idsAdded.has(item.id)) {
                return undefined;
            }
            idsAdded.add(item.id);
            return item;
        })
        .filter((e) => e)
        .map((e) => {
            const quantity = getQuantityToLose(user, e!, random);
            return {
                itemId: e!.itemId,
                quantity: quantity,
                id: e!.id,
            } as ItemLoss;
        });

    return itemsToGo;
};

const getQuantityToLose = (user: FullUser, item: InventoryItem, random?: RandomSeed) => {
    random = random ?? getUserRandom(user);

    if (item.quantity > 6) {
        const percentToLose = weightedReward(random, [
            [[0.01, 0.5], 0.5],
            [[0.1, 0.3], 0.3],
            [[0.03, 0.1], 0.1],
            [[0.4, 0.7], 0.1],
        ], true);

        return Math.min(1, Math.floor(item.quantity * percentToLose));
    }

    return Math.min(
        weightedChoice([
            [1, 0.5],
            [2, 0.3],
            [3, 0.2],
        ]),
        item.quantity,
    );
};
