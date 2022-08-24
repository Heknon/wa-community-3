import {WASocket} from "@adiwajshing/baileys";
import {BlockedReason} from "../../../blockable/blocked_reason";
import Message from "../../../../lib/messaging/message";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";
import languages from "../../../config/language.json";
import {AccountType} from "@prisma/client";
import {Chat, User} from "../../../db/types";

export default class PingCommand extends Command {
    private language: typeof languages.commands.ping[Language];

    constructor(language: Language) {
        const langs = languages.commands.ping;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            description: lang.description,
            cooldowns: new Map([
                [AccountType.USER, 500],
                [AccountType.DONOR, 250],
                [AccountType.SPONSOR, 0],
            ]),
        });

        this.language = lang;
    }

    async onBlocked(msg: Message, blockedReason: BlockedReason) {}

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        const time = Math.abs(Date.now() - Number(message.raw!.messageTimestamp!) * 1000);
        await message.reply(this.language.execution.success_message, true, {
            placeholder: {
                custom: new Map([["time", time.toString()]]),
            },
        });
    }
}
