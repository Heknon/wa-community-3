import {WASocket} from "@adiwajshing/baileys";
import Message from "../../../../../lib/messaging/message";
import Command from "../../../command";
import CommandTrigger from "../../../command_trigger";
import {BlockedReason} from "../../../../blockable";
import languages from "../../../../config/language.json";
import {BotClient} from "../../../../whatsapp_bot";
import { Chat, GroupLevel, User } from "../../../../db/types";

export default class    DeleteCommand extends Command {
    private language: typeof languages.commands.delete[Language];

    constructor(language: Language) {
        const langs = languages.commands.delete;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            description: lang.description,
            groupLevel: GroupLevel.ADMIN,
        });

        this.language = lang;
    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        const raw = message.raw!;
        const quoted = message.quoted;
        if (!quoted || !quoted.raw) {
            return message.reply(this.language.execution.no_reply, true);
        }

        if (quoted.from != BotClient.currentClientId) {
            try {
                quoted.raw.key.fromMe = false;
                await client.sendMessage(raw.key.remoteJid!, {delete: quoted.raw.key});
                return;
            } catch (err) {
                return message.reply(this.language.execution.failed, true);
            }
        }

        try {
            quoted.raw.key.fromMe = true;
            await client.sendMessage(raw.key.remoteJid!, {delete: quoted.raw?.key!});
        } catch (err) {
            return message.reply(this.language.execution.failed, true);
        }
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {
        switch (blockedReason) {
            case BlockedReason.InsufficientGroupLevel:
                return data.reply(this.language.execution.only_admin, true);
            default:
                return;
        }
    }
}
