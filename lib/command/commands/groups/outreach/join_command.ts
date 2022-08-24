import {WASocket} from "@adiwajshing/baileys";
import Message from "../../../../../lib/messaging/message";
import Command from "../../../command";
import CommandTrigger from "../../../command_trigger";
import {BlockedReason} from "../../../../blockable";
import languages from "../../../../config/language.json";
import {Chat, User} from "../../../../db/types";

export default class JoinCommand extends Command {
    private language: typeof languages.commands.join[Language];

    constructor(language: Language) {
        const langs = languages.commands.join;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            description: lang.description,
            extendedDescription: lang.extended_description,
        });

        this.language = lang;
    }

    private groupInviteRegex: RegExp = RegExp(
        /(https?:\/\/)?chat\.whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9_-]{22})/g,
    );

    async execute(
        client: WASocket,
        chat: Chat,
        user: User,
        message: Message,
        body: string,
        trigger: CommandTrigger,
    ) {
        let matches = this.groupInviteRegex.exec(body ?? "");
        const quoted = message.quoted;
        if ((!matches || (matches && matches.length == 0)) && quoted)
            matches = this.groupInviteRegex.exec(quoted.content ?? "");

        if (!matches || (matches && matches.length == 0)) {
            return await message.reply(this.language.execution.no_invite, true);
        }

        const code = matches[2];

        client
            .groupAcceptInvite(code)
            .then(async (res) => {
                if (!res) {
                    return await message.reply(this.language.execution.failed, true);
                }
                const meta = await client.groupMetadata(res);
                await message.reply(this.language.execution.joined, true, {
                    placeholder: {custom: new Map([["group", meta.subject]])},
                });
            })
            .catch((err) => {
                message.reply(this.language.execution.failed, true);
            });
        await message.reply(this.language.execution.joining, true);
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
