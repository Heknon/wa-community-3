import items from "../../config/items.json";
import {Apple} from "./apple";
import {Bread} from "./bread";

export type ItemID = typeof items[number]["id"];
export type ItemData = typeof items[number];

export const itemsMapped = new Map<ItemID, ItemData>(items.map((item) => [item.id, item]));
export const getItemData = (itemId: ItemID) => {
    return itemsMapped.get(itemId);
};

export const getAllItems = () => {
    return items;
};

const itemClasses = [Bread, Apple];
export default function getItem(itemId: ItemID) {
    const itemData = getItemData(itemId);
    if (!itemData) return;

    for (const item of itemClasses) {
        if (item.name.toLowerCase() === itemId.toLowerCase().trim()) {
            return new item(itemData);
        }
    }
}

