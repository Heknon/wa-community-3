import EconomyCommand from "../../economy_command";
import languages from "../../../config/language.json";
import {BlockedReason} from "../../../blockable";
import {WASocket} from "@adiwajshing/baileys";
import CommandTrigger from "../../command_trigger";
import {AccountType} from "@prisma/client";
import Message from "../../../messaging/message";
import {Chat, User} from "../../../db/types";

export default class StealCommand extends EconomyCommand {
    private language: typeof languages.commands.steal[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.steal;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
            usage: lang.usage,
            cooldowns: new Map([
                [AccountType.USER, 20 * 60 * 1000],
                [AccountType.DONOR, 15 * 60 * 1000],
                [AccountType.SPONSOR, 10 * 60 * 1000],
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
        
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
