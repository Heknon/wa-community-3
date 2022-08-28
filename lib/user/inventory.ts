import {Prisma} from "@prisma/client";
import {prisma} from "../db/client";
import {User} from "../db/types";
import {getItemData, ItemID} from "../economy/items";
import Item from "../economy/items/item";

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

export const userRegisterItemUse = async (user: User, item: Item) => {
    const itemData = getInventoryItem(user, item.data.id);
    if (!itemData) return;

    itemData.uses++;

    if (itemData.uses >= itemData.item.durability) {
        itemData.quantity -= 1;
    }

    if (itemData.quantity <= 0) {
        return await prisma.inventoryItem.delete({
            where: {
                id: itemData.id,
            },
        });
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
