import {isJidGroup, isJidUser, WASocket} from "@adiwajshing/baileys";
import Message from "../../../../../lib/messaging/message";
import Command from "../../../command";
import CommandTrigger from "../../../command_trigger";
import vCard from "vcard-parser";
import {getGroupPrivilegeMap} from "../../../../utils/group_utils";
import {rescueNumbers} from "../../../../utils/regex_utils";
import languages from "../../../../config/language.json";
import {Chat, GroupLevel, User} from "../../../../db/types";
import {BotClient} from "../../../../whatsapp_bot";
import {logger} from "../../../../logger";
import {BlockedReason} from "../../../../blockable";

export default class AddCommand extends Command {
    private language: typeof languages.commands.add[Language];

    constructor(language: Language) {
        const langs = languages.commands.add;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            description: lang.description,
            blockedChats: ["DM"],
            groupLevel: GroupLevel.ADMIN,
        });

        this.language = lang;
    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        const adminMap = await getGroupPrivilegeMap(client, message.to);
        const iAmAdmin: boolean = adminMap[BotClient.currentClientId!] > 0;

        if (!iAmAdmin) {
            return await message.reply(this.language.execution.bot_no_admin, true);
        }

        let vcards =
            message.raw!.message?.extendedTextMessage?.contextInfo?.quotedMessage?.contactMessage?.vcard ||
            message.raw!.message?.extendedTextMessage?.contextInfo?.quotedMessage?.contactsArrayMessage?.contacts!.map(
                (contact) => contact.vcard,
            ) ||
            [];

        if (vcards.length > 0) {
            const allNumbers = new Set<string>();
            if (vcards && typeof vcards == typeof "") {
                vcards = [vcards as string];
            }

            (vcards as string[]).forEach(async (vcard) => {
                const vc = vCard.parse(vcard);
                const numbers = vc.tel.map((telObject) => {
                    return telObject.meta["waid"] + "@s.whatsapp.net";
                });

                numbers.forEach((n) => allNumbers.add(n));
            });

            let failedList: Array<string> = [];
            for (const number of allNumbers) {
                try {
                    await client.groupParticipantsUpdate(message.to, [number], "add");
                } catch (error) {
                    logger.error(error);
                    failedList.push(number);
                }
            }
            if (failedList.length > 0) {
                return message.reply(this.language.execution.failed_add, true, {
                    placeholder: {chat, custom: new Map([["text", failedList.join(", ")]])},
                });
            }

            return message.reply(this.language.execution.success, true);
        }

        if (!body) {
            return message.reply(this.language.execution.no_body, true);
        }

        const numbers = rescueNumbers(body, "972")
            .map((num) => {
                return num + "@s.whatsapp.net";
            })
            .filter((num) => isJidUser(num));

        let failedList: Array<string> = [];
        for (const number of numbers) {
            try {
                await client.groupParticipantsUpdate(message.to, [number], "add");
            } catch (error) {
                logger.error(error);
                failedList.push(number);
            }
        }
        if (failedList.length > 0) {
            return message.reply(this.language.execution.failed_add, true, {
                placeholder: {chat, custom: new Map([["text", failedList.join(", ")]])},
            });
        }

        return message.reply(this.language.execution.success, true);
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {
        if (blockedReason === BlockedReason.BlockedChat) {
            return data.reply(this.language.execution.blocked_chat, true);
        }
    }
}
