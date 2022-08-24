import {WASocket} from "@adiwajshing/baileys";
import {BlockedReason} from "../../../blockable/blocked_reason";
import Message from "../../../../lib/messaging/message";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";
import languages from "../../../config/language.json";
import config from "../../../config/config.json";
import {Chat, User} from "../../../db/types";

export default class CodeCommand extends Command {
    private language: typeof languages.commands.code[Language];

    constructor(language: Language) {
        const langs = languages.commands.code;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
        });

        this.language = lang;
    }

    async onBlocked(msg: Message, blockedReason: BlockedReason) {}

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        await message.reply(
            config.github_repo +
                "\n\nכרגע ניתן לצפות רק בגרסה מופחתת של הקוד בגלל שיקולים מסויימים, סליחה.\nנעשה שימוש בספרייה: https://github.com/adiwajshing/Baileys",
            true,
        );
    }
}
