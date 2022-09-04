import {WASocket} from "@adiwajshing/baileys";
import Message from "../../../../../lib/messaging/message";
import Command from "../../../command";
import CommandTrigger from "../../../command_trigger";
import {BlockedReason} from "../../../../blockable";
import languages from "../../../../config/language.json";
import config from "../../../../config/config.json";
import {waitForMessage} from "../../../../utils/message_utils";
import { Chat, User } from "../../../../db/types";
import { logger } from "../../../../logger";

export default class CommunityCommand extends Command {
    private language: typeof languages.commands.community[Language];

    constructor(language: Language) {
        const langs = languages.commands.community;
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
        const res = await message.reply(this.language.execution.join_message, true, {
            placeholder: {
                custom: {
                    link: "https://chat.whatsapp.com/C3fRIrfoqBUJa6PhJMUdU2",
                },
            },
        });
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
