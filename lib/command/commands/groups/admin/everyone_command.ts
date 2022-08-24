import {WASocket} from "@adiwajshing/baileys";
import Message from "../../../../../lib/messaging/message";
import Command from "../../../command";
import CommandTrigger from "../../../command_trigger";
import {BlockedReason} from "../../../../blockable";
import languages from "../../../../config/language.json";
import {Chat, User} from "../../../../db/types";
import {messagingService} from "../../../../messaging";

export default class EveryoneCommand extends Command {
    private language: typeof languages.commands.everyone[Language];
    public languageData: typeof languages.commands.everyone;
    public languageCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.everyone;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            description: lang.description,
            groupLevel: "ADMIN",
            blockedChats: ["DM"],
            extendedDescription: lang.extended_description,
        });

        this.languageData = langs;
        this.language = lang;
        this.languageCode = language;
    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        const group = await client.groupMetadata(message.to);

        const mentions = group.participants.map((participant) => participant.id);
        const quoted = message.quoted ? message.quoted?.raw ?? message.raw : message.raw;

        messagingService.sendMessage(
            message.to,
            {
                text: this.language.execution.success,
                mentions: mentions,
            },
            {quoted: quoted ?? undefined},
            {
                placeholder: {
                    chat,
                    command: this,
                    custom: new Map([["tags", mentions.map((mention) => `@${mention.split("@")[0]}`).join(" ")]]),
                },
            },
        );
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {
        switch (blockedReason) {
            case BlockedReason.InsufficientGroupLevel:
                return data.reply(this.language.execution.only_admin, true);
            case BlockedReason.BlockedChat:
                return data.reply(this.language.execution.only_group);
            default:
                return;
        }
    }
}
