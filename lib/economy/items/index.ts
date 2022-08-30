import items from "../../config/items.json";
import {Apple} from "./apple";
import {BankNote} from "./banknote";
import {BoxOfSand} from "./boxofsand";
import {Bread} from "./bread";
import {CoinBomb} from "./coinbomb";
import {FakeID} from "./fakeid";
import {HuntingRifle} from "./huntingrifle";
import {Landmine} from "./landmine";
import {Lifesaver} from "./lifesaver";
import {Padlock} from "./padlock";
import {RobbersWishlist} from "./robberswishlist";

export type ItemID = typeof items[number]["id"];
export type ItemData = typeof items[number];

export const itemsMapped = new Map<ItemID, ItemData>(items.map((item) => [item.id, item]));
export const getItemData = (itemId: ItemID) => {
    return itemsMapped.get(itemId);
};

export const getAllItems = () => {
    return items;
};

const itemClasses: (
    | typeof Bread
    | typeof HuntingRifle
    | typeof Apple
    | typeof BankNote
    | typeof BoxOfSand
    | typeof CoinBomb
    | typeof FakeID
    | typeof Landmine
    | typeof Lifesaver
    | typeof Padlock
    | typeof RobbersWishlist
)[] = [
    Bread,
    HuntingRifle,
    Apple,
    BankNote,
    BoxOfSand,
    CoinBomb,
    FakeID,
    Landmine,
    Lifesaver,
    Padlock,
    RobbersWishlist,
];
export default function getItem(itemId: ItemID) {
    const itemData = getItemData(itemId);
    if (!itemData) return;

    for (const item of itemClasses) {
        if (item.name.toLowerCase() === itemId.toLowerCase().trim()) {
            return new item(itemData);
        }
    }
}
