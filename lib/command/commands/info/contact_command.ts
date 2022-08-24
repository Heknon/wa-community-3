import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {BlockedReason} from "../../../blockable/blocked_reason";
import Message from "../../../../lib/messaging/message";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";
import languages from "../../../config/language.json";
import {rescueNumbers} from "../../../utils/regex_utils";
import VCard from "vcard-creator";
import {Chat, User} from "../../../db/types";
import {buildVCardFromJID} from "../../../utils/utils";

export default class VCardCommand extends Command {
    private language: typeof languages.commands.vcard[Language];

    constructor(language: Language) {
        const langs = languages.commands.vcard;
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

    async onBlocked(message: Message, blockedReason: BlockedReason) {}

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        let jids = Array.from(new Set(rescueNumbers(body).map((e) => e + "@s.whatsapp.net")));

        const vcards = (await Promise.all(jids.map((e) => buildVCardFromJID(e)))).filter((e) => e) as [VCard, string][];
        if (!vcards || vcards.length === 0) {
            return await message.reply(this.language.execution.no_number, true, {
                placeholder: this.getDefaultPlaceholder({chat, message}),
            });
        }

        await message.replyAdvanced({
            contacts: {
                contacts: vcards.map((e) => {
                    return {
                        displayName: e[1],
                        vcard: e[0].toString(),
                    };
                }),
            },
        });
    }
}
