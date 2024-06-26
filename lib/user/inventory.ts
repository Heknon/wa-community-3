import {Prisma} from "@prisma/client";
import cuid from "cuid";
import {prisma} from "../db/client";
import {User} from "../db/types";
import {getItemData, ItemData, ItemID} from "../economy/items";
import Item from "../economy/items/item";

type InventoryItem = ReturnType<typeof getInventory>[number];

export const getInventory = (user: User) => {
    return user.items.map((e) => ({
        ...e,
        item: getItemData(e.itemId),
    }));
};

export const getInventoryItem = (
    user: Prisma.UserGetPayload<{include: {items: true}}>,
    itemId: ItemID,
) => {
    const invItem = user.items.find((e) => e.itemId === itemId);
    if (!invItem) return;
    const itemData = getItemData(itemId);
    if (!itemData) return;

    return {
        ...invItem,
        item: itemData,
    };
};

export const giveItemToUser = async (user: User, itemId: ItemID, quantity: number = 1) => {
    const item = getItemData(itemId);
    if (!item) return;
    const invItem = getInventoryItem(user, itemId);

    const amount = Math.max((invItem?.quantity ?? 0) + quantity, 0);
    if (amount === 0 && invItem) {
        try {
            return await prisma.inventoryItem.delete({
                where: {
                    id: invItem.id,
                },
            });
        } catch (e) {
            console.error(e);
        }
    }
    const updatedUser = await prisma.inventoryItem.upsert({
        where: {
            id: invItem?.id ?? cuid(),
        },
        create: {
            itemId: itemId,
            quantity: amount,
            user: {connect: {jid: user.jid}},
        },
        update: {
            quantity: amount,
        },
    });
    return updatedUser;
};

export const userRegisterItemUse = async (user: User, item: ItemData) => {
    const itemData = getInventoryItem(user, item.id);
    if (!itemData) return;

    itemData.uses++;

    if (itemData.uses >= itemData.item.durability) {
        itemData.quantity -= 1;
    }

    if (itemData.quantity <= 0) {
        try {
            return await prisma.inventoryItem.delete({
                where: {
                    id: itemData.id,
                },
            });
        } catch (e) {
            console.error(e);
            return;
        }
    }

    await prisma.inventoryItem.update({
        where: {
            id: itemData.id,
        },
        data: {
            quantity: itemData.quantity,
            uses: itemData.uses,
        },
    });
};
