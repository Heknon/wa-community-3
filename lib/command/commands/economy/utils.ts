import {commas} from "../../../utils/utils";
import languages from "../../../config/language.json";
import {RandomSeed} from "random-seed";
import weightedRandom from "weighted-random";
import {Balance} from "../../economy_command";

export function buildBalanceChangeMessage(
    previous: Balance,
    current: Balance,
    previousNet: number,
    currentNet: number,
    langCode: Language,
    bankCapacity?: number,
) {
    const havePlus = (num: number) => (num > 0 ? "+" : "");
    const currentBank = current.bank ?? 0;
    const currentWallet = current.wallet ?? 0;
    const previousBank = previous.bank ?? 0;
    const previousWallet = previous.wallet ?? 0;

    const netDiff = currentNet - previousNet;
    const walletDiff = currentWallet - previousWallet;
    const bankDiff = currentBank - previousBank;

    const capacityText = bankCapacity
        ? ` / ${commas(bankCapacity)} (${((currentBank / bankCapacity) * 100).toFixed(1)}%)`
        : "";
    const walletText =
        walletDiff! + 0
            ? `${commas(previousWallet)} => ${commas(currentWallet)} (${havePlus(
                  walletDiff,
              )}${commas(walletDiff)})`
            : `${commas(currentWallet)}`;

    const bankText =
        bankDiff != 0
            ? `${commas(previousBank)} => ${commas(currentBank)}${capacityText} (${havePlus(
                  bankDiff,
              )}${commas(bankDiff)})`
            : `${commas(currentBank)}${capacityText}`;

    const netText = `${commas(previousNet)} => ${commas(currentNet)} (${havePlus(netDiff)}${commas(
        netDiff,
    )})`;

    return `*${languages.economy.wallet[langCode]}:* ${walletText}\n*${languages.economy.bank[langCode]}:* ${bankText}\n*${languages.economy.net[langCode]}:* ${netText}`;
}

/**
 * allows support for number prefixes such as k (thousand), m (million), b (billion)...
 * @param str string to extract numbers from
 * @returns a list of numbers that exist in the string
 */
export function extractNumbers(str: string): number[] {
    const numbers = (str.match(/((-\d+)|\d+)[a-zA-Z]*/g) ?? []).map((numData) => {
        const numStr = numData.match(/(-\d+)|\d+/g)?.[0] ?? "";
        const numPrefix = numData.match(/[a-zA-Z]+/g)?.[0] ?? "";
        const num = Number(numStr);

        if (numPrefix === "" || !numPrefix) {
            return num;
        } else if (numPrefix.startsWith("k")) {
            return num * 1000;
        } else if (numPrefix.startsWith("m")) {
            return num * 1000000;
        } else if (numPrefix.startsWith("b")) {
            return num * 1000000000;
        } else if (numPrefix.startsWith("t")) {
            return num * 1000000000000;
        } else if (numPrefix.startsWith("q")) {
            return num * 1000000000000000;
        }

        return num;
    });

    return numbers;
}

/**
 * for intuitiveness, make sure weights sum to multiple of 10
 * @param weightRewards key is reward range ([min, max]) - value is chance
 * @returns
 */
export function weightedReward(
    random: RandomSeed,
    weightRewards: [[number, number], number][],
    useFloat: boolean = false
): number {
    const rewardRange = weightedChoice(weightRewards);
    return useFloat ? random.floatBetween(rewardRange[0], rewardRange[1]) : random.intBetween(rewardRange[0], rewardRange[1]);
}

/**
 * choose a weighted random value from an array
 * @param weightedArray array with a value and a weight for that value
 * @returns the value chosen
 */
export function weightedChoice<T>(weightedArray: [T, number][]): T {
    const weights = weightedArray.map(([, weight]) => weight);
    const chosenIndex = weightedRandom(weights);
    return weightedArray[chosenIndex][0];
}

export function choice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}
