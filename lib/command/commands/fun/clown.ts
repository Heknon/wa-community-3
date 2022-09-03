import {proto, WASocket} from "@adiwajshing/baileys";
import url from "node:url";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";
import {BlockedReason} from "../../../blockable";
import languages from "../../../config/language.json";
import {Chat, User} from "../../../db/types";
import Message from "../../../messaging/message";
import {messagingService} from "../../../messaging";

export default class ClownCommand extends Command {
    private language: typeof languages.commands.clown[Language];

    constructor(language: Language) {
        const langs = languages.commands.clown;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            description: lang.description,
        });

        this.language = lang;
    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        const quoted = message.quoted;

        if (!quoted || !quoted.content || quoted.content.length == 0) {
            return await message.reply(this.language.execution.no_reply, true);
        }

        if (quoted.fromBot) {
            return await message.reply(this.language.execution.clown_bot, true);
        }

        await quoted.replyAdvanced({text: this.language.execution.format, mentions: quoted.mentions}, true, {
            placeholder: {
                chat,
                custom: {
                    message: quoted.content,
                },
            },
        });

        await messagingService.sendMessage(message.raw?.key.remoteJid!, {
            react: {key: quoted.raw!.key!, text: "🤡", groupingKey: "clown", senderTimestampMs: Date.now()},
        });
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
