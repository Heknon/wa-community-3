import {isJidGroup, WASocket} from "@adiwajshing/baileys";
import Message from "../../../../../lib/messaging/message";
import Command from "../../../command";
import CommandTrigger from "../../../command_trigger";
import {BlockedReason} from "../../../../blockable";
import languages from "../../../../config/language.json";
import {Chat, GroupLevel, User} from "../../../../db/types";

export default class GtfoCommand extends Command {
    private language: typeof languages.commands.gtfo[Language];

    constructor(language: Language) {
        const langs = languages.commands.gtfo;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            description: lang.description,
            groupLevel: GroupLevel.ADMIN,
            blockedChats: ["DM"],
        });

        this.language = lang;
    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        await client.groupLeave(message.to).then(() => {
            message.reply(this.language.execution.success, true);
        });
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {
        switch (blockedReason) {
            case BlockedReason.InsufficientGroupLevel:
                return data.reply(this.language.execution.only_admin, true);
            case BlockedReason.BlockedChat:
                return data.reply(this.language.execution.only_group, true);
            default:
                return;
        }
    }
}
