import {WASocket} from "@adiwajshing/baileys";
import {BlockedReason} from "../../../../blockable";
import CommandTrigger from "../../../command_trigger";
import InteractableCommand from "../../../interactable_command";
import languages from "../../../../config/language.json";
import {Chat, User} from "../../../../db/types";
import Message from "../../../../messaging/message";
import {prisma} from "../../../../db/client";

export default class PrefixCommand extends InteractableCommand {
    private language: typeof languages.commands.prefix[Language];

    constructor(language: Language) {
        const langs = languages.commands.prefix;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            description: lang.description,
            groupLevel: "ADMIN",
        });

        this.language = lang;
    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        const newPrefix = body?.trim();
        if (!newPrefix) {
            return message.reply(this.language.execution.no_content);
        } else if (newPrefix.length > 10) {
            return message.reply(this.language.execution.too_long);
        }

        await prisma.chat.update({
            where: {jid: chat.jid},
            data: {
                prefix: newPrefix,
            },
        });

        return message.reply(this.language.execution.success, true, {
            placeholder: {
                custom: new Map([["prefix", newPrefix]]),
            },
        });
    }

    async onBlocked(data: Message, blockedReason: BlockedReason) {
        if (blockedReason === BlockedReason.InsufficientGroupLevel) {
            await data.reply(this.language.execution.only_admin, true);
        }
        return "";
    }
}
