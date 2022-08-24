import {WASocket} from "@adiwajshing/baileys";
import {BlockedReason} from "../../../../blockable";
import CommandTrigger from "../../../command_trigger";
import InteractableCommand from "../../../interactable_command";
import languages from "../../../../config/language.json";
import Message from "../../../../messaging/message";
import {Chat, User} from "../../../../db/types";
import {prisma} from "../../../../db/client";

export default class LanguageCommand extends InteractableCommand {
    constructor() {
        super({
            triggers: ["language", "שפה"].map((e) => new CommandTrigger(e)),
            usage: "{prefix}{command}",
            category: "Language/שפה",
            groupLevel: "ADMIN",
            description: "Change language. החלפת שפה.",
        });
    }

    async execute(
        client: WASocket,
        chat: Chat,
        user: User,
        message: Message,
        body: string,
        trigger: CommandTrigger,
    ) {
        const availableLanguages = languages.languages;

        if (!body || !availableLanguages.some((e) => body.trim().startsWith(e))) {
            return await message.reply(
                availableLanguages.map((e) => `{prefix}{command} ${e}`).join("\n"),
                true,
                {
                    placeholder: {command: this, chat, message},
                },
            );
        }

        const language = body
            .trim()
            .toLowerCase()
            .replace("אנגלית", "english")
            .replace("עברית", "hebrew");

        const langUsed = /(english|hebrew)/i.exec(language)?.[0] ?? "hebrew";
        const updatedChat = await prisma.chat.update({
            where: {jid: chat.jid},
            data: {language: langUsed as Language},
        });

        const lang = languages.language_changed[updatedChat.language];
        return await message.reply(lang, true);
    }

    async onBlocked(data: Message, blockedReason: BlockedReason) {
        if (blockedReason === BlockedReason.InsufficientGroupLevel) {
            await data.reply(
                "Ask an admin to change the language for this chat.\nתבקש מאדמין לשנות את השפה בקבוצה הזו.",
                true,
            );
        }
        return "";
    }
}
