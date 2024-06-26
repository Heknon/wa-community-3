import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {CommandTrigger, EconomyCommand} from "../..";
import {BlockedReason} from "../../../blockable";
import {commas} from "../../../utils/utils";
import languages from "../../../config/language.json";
import {Chat, User} from "../../../db/types";
import Message from "../../../messaging/message";
import {prisma} from "../../../db/client";
import {removeCommandCooldown, userCalculateNetBalance} from "../../../user/user";
import {createUser} from "../../../user/database_interactions";
import {AccountType} from "@prisma/client";
import {getCommandByTrigger} from "../../../chat/chat";

export default class PassiveCommand extends EconomyCommand {
    private language: typeof languages.commands.passive[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.passive;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
            extendedDescription: lang.extended_description,
            usage: lang.usage,
            cooldowns: new Map([
                [AccountType.USER, 1000 * 60 * 60 * 30],
                [AccountType.DONOR, 1000 * 60 * 60 * 20],
                [AccountType.SPONSOR, 1000 * 60 * 60 * 18],
            ]),
        });

        this.language = lang;
        this.langCode = language;
    }

    async execute(
        client: WASocket,
        chat: Chat,
        user: User,
        message: Message,
        body: string,
        trigger: CommandTrigger,
    ) {
        const toggledTo = !user.passive;
        await prisma.user.update({
            where: {
                jid: user.jid,
            },
            data: {
                passive: toggledTo,
            },
        });

        if (toggledTo) {
            const steal = await getCommandByTrigger(chat, "steal");
            if (steal) removeCommandCooldown(user, steal);
        }
        await message.reply(this.language.execution[toggledTo ? "enabled" : "disabled"], true);
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
