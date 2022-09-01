import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {CommandTrigger, EconomyCommand} from "../..";
import {BlockedReason} from "../../../blockable";
import {commas} from "../../../utils/utils";
import languages from "../../../config/language.json";
import {Chat, User} from "../../../db/types";
import Message from "../../../messaging/message";
import {prisma, redis} from "../../../db/client";
import {userCalculateNetBalance} from "../../../user/user";
import {createUser} from "../../../user/database_interactions";
import {Prisma} from "@prisma/client";

type BaltopUserData = {
    jid: string;
    wallet: number;
    bank: number;
    phone: string;
    fakeid: string | undefined;
};

export default class BaltopCommand extends EconomyCommand {
    private language: typeof languages.commands.upgrade_group[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.upgrade_group;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
            usage: lang.usage,
            groupAccountType: "blocked",
            blockedChats: ["DM"],
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
        
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {
        if (blockedReason == BlockedReason.BlockedChat) {
            data.reply(languages.onlygroups[this.langCode]);
        } else if (blockedReason == BlockedReason.BadAccountType) {
            data.reply(this.language.execution.not_donor, true);
        }
    }
}
