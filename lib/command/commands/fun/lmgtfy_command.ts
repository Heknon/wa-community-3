import {proto, WASocket} from "@adiwajshing/baileys";
import url from "node:url";
import Message from "../../../../lib/messaging/message";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";
import {BlockedReason} from "../../../blockable";
import languages from "../../../config/language.json";
import { Chat, User } from "@prisma/client";

export default class LmgtfyCommand extends Command {
    private language: typeof languages.commands.lmgtfy[Language];

    constructor(language: Language) {
        const langs = languages.commands.lmgtfy;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            description: lang.description,
            extendedDescription: lang.extended_description,
        });

        this.language = lang;
    }

    private readonly base_link = "https://lmgtfy.app/?q=";

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        if (!body) {
            return await message.reply(this.language.execution.no_body, true);
        }

        const link = url.format(this.base_link + body + "&iie=1");
        await message.reply(this.language.execution.message, true, {
            placeholder: {chat, custom: new Map([["link", link]])},
        });
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
