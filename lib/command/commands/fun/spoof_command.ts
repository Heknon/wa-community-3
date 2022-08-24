import {WASocket} from "@adiwajshing/baileys";
import Message from "../../../../lib/messaging/message";
import CommandTrigger from "../../command_trigger";
import {BlockedReason} from "../../../blockable";
import Command from "../../command";
import languages from "../../../config/language.json";
import {User} from "@prisma/client";
import {Chat} from "../../../db/types";
import {messagingService} from "../../../messaging";

export default class SpoofCommand extends Command {
    private language: typeof languages.commands.spoof[Language];

    constructor(language: Language) {
        const langs = languages.commands.spoof;
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
        if (!body) {
            return await this.error(message, chat);
        }

        body = body.replace(/״/gim, '"');
        const splitBody = body?.split(" ");
        const mentioned = splitBody?.shift()?.slice(1);
        const quotedPart = splitBody?.join(" ");
        if (!mentioned || !quotedPart) {
            return this.error(message, chat);
        }

        const quotes = [...quotedPart.matchAll(RegExp(/"(.*?)"/, "g"))];
        if (!body || quotes?.length != 2) {
            return await this.error(message, chat);
        }

        const rawMessage = message.raw;
        if (!rawMessage) {
            return message.reply("There seems to have been an error. Please try again.", true);
        }

        rawMessage.key.participant = mentioned + "@s.whatsapp.net";
        if (rawMessage.message!.extendedTextMessage) rawMessage.message!.extendedTextMessage!.text = quotes[0][1];
        rawMessage.message!.conversation = quotes[0][1];

        await messagingService.sendMessage(rawMessage.key.remoteJid!, {text: quotes[1][1]}, {quoted: rawMessage});
    }

    private async error(message: Message, chat: Chat) {
        return await message.reply(this.language.execution.error, true, {
            placeholder: {
                chat,
                command: this,
            },
        });
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
