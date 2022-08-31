export const Rarity: {
    COMMON: "COMMON";
    UNCOMMON: "UNCOMMON";
    RARE: "RARE";
    EPIC: "EPIC";
    LEGENDARY: "LEGENDARY";
    MYTHICAL: "MYTHICAL";
    ARTIFACT: "ARTIFACT";
    RELIC: "RELIC";
    UNKNOWN: "UNKNOWN";
} = {
    COMMON: "COMMON",
    UNCOMMON: "UNCOMMON",
    RARE: "RARE",
    EPIC: "EPIC",
    LEGENDARY: "LEGENDARY",
    MYTHICAL: "MYTHICAL",
    ARTIFACT: "ARTIFACT",
    RELIC: "RELIC",
    UNKNOWN: "UNKNOWN",
};

export type RarityKey = keyof typeof Rarity;
