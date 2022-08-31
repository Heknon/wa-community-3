import {Rarity, RarityKey} from "./rarity";

export const rarityToNumber = (rarity: RarityKey | undefined) => {
    switch (rarity?.toUpperCase()) {
        case Rarity.COMMON:
            return 1;
        case Rarity.UNCOMMON:
            return 2;
        case Rarity.RARE:
            return 3;
        case Rarity.EPIC:
            return 4;
        case Rarity.LEGENDARY:
            return 5;
        case Rarity.MYTHICAL:
            return 6;
        case Rarity.ARTIFACT:
            return 7;
        case Rarity.RELIC:
            return 8;
        case Rarity.UNKNOWN:
            return 9;
        default:
            return 0;
    }
};
