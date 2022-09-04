import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {CommandTrigger, EconomyCommand} from "../..";
import {BlockedReason} from "../../../blockable";
import {commas} from "../../../utils/utils";
import languages from "../../../config/language.json";
import {Chat, User} from "../../../db/types";
import Message from "../../../messaging/message";
import {prisma} from "../../../db/client";
import {getUserRandom, userCalculateNetBalance} from "../../../user/user";
import {createUser} from "../../../user/database_interactions";
import {choice, weightedChoice, weightedReward} from "./utils";
import {getItemData} from "../../../economy/items";
import {getInventory, giveItemToUser, userRegisterItemUse} from "../../../user/inventory";

export default class HuntCommand extends EconomyCommand {
    private language: typeof languages.commands.hunt[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.hunt;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
            usage: lang.usage,
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
        const rifle = getInventory(user).find((e) => e.item?.id === "huntingrifle");
        if (!rifle) {
            return await message.reply(this.language.execution.nogun, true);
        }

        const random = getUserRandom(user);
        const drop = weightedChoice([
            [undefined, 46],
            [getItemData("skunk")!, 25],
            [getItemData("rabbit")!, 14],
            [getItemData("duck")!, 8],
            [getItemData("deer")!, 5.5],
            [getItemData("boar")!, 1.5],
        ]);

        if (random.intBetween(1, 100) <= 5) {
            await userRegisterItemUse(user, rifle.item!);
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
