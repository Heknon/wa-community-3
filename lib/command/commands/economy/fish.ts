import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {CommandTrigger, EconomyCommand} from "../..";
import {BlockedReason} from "../../../blockable";
import languages from "../../../config/language.json";
import {Chat, User} from "../../../db/types";
import Message from "../../../messaging/message";
import {getUserRandom} from "../../../user/user";
import {choice, weightedChoice} from "./utils";
import {getItemData} from "../../../economy/items";
import {getInventory, giveItemToUser, userRegisterItemUse} from "../../../user/inventory";
import { AccountType } from "@prisma/client";

export default class FishCommand extends EconomyCommand {
    private language: typeof languages.commands.fish[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.fish;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
            usage: lang.usage,
            cooldowns: new Map([
                [AccountType.USER, 50 * 1000],
                [AccountType.DONOR, 40 * 1000],
                [AccountType.SPONSOR, 30 * 1000],
            ]),
        });

        this.language = lang;
        this.langCode = language;
    }

    async execute(
        client: WASocket,
        chat: Chat,
        user: User,
        message: Message,
        body: string,
        trigger: CommandTrigger,
    ) {
        const fishingpole = getInventory(user).find((e) => e.item?.id === "fishingpole");
        if (!fishingpole) {
            await message.reply(this.language.execution.nopole, true);
            return false;
        }

        const random = getUserRandom(user);
        const drop = weightedChoice([
            [undefined, 43],
            [
                choice([
                    getItemData("commonfish")!,
                    getItemData("seaweed")!,
                    getItemData("garbage")!,
                ]),
                37,
            ],
            [
                choice([
                    getItemData("rarefish")!,
                    getItemData("boxofsand")!,
                    getItemData("fishingpole")!,
                ]),
                13,
            ],
            [
                choice([
                    getItemData("exoticfish")!,
                    getItemData("jellyfish")!,
                    getItemData("banknote")!,
                ]),
                6.8,
            ],
            [choice([getItemData("legendaryfish")!, getItemData("kraken")!]), 0.2],
        ]);

        if (random.intBetween(1, 100) <= 5) {
            await userRegisterItemUse(user, fishingpole.item!);
        }

        if (drop) {
            await giveItemToUser(user, drop.id, 1);
            await message.reply(this.language.execution.found, true, {
                placeholder: {
                    custom: {
                        item: drop.name[this.langCode],
                    },
                },
            });
            return;
        } else {
            await message.reply(choice(this.language.execution.nothing), true);
            return;
        }
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
