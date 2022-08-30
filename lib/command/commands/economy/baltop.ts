import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {CommandTrigger, EconomyCommand} from "../..";
import {BlockedReason} from "../../../blockable";
import {commas} from "../../../utils/utils";
import languages from "../../../config/language.json";
import {Chat, User} from "../../../db/types";
import Message from "../../../messaging/message";
import {prisma} from "../../../db/client";
import { userCalculateNetBalance } from "../../../user/user";
import { createUser } from "../../../user/database_interactions";

export default class BalanceCommand extends EconomyCommand {
    private language: typeof languages.commands.baltop[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.baltop;
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
        
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
