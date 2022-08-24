import {WASocket} from "@adiwajshing/baileys";
import Message from "../../../../../lib/messaging/message";
import Command from "../../../command";
import CommandTrigger from "../../../command_trigger";
import {getGroupPrivilegeMap} from "../../../../utils/group_utils";
import {BlockedReason} from "../../../../blockable";
import languages from "../../../../config/language.json";
import {Chat, User} from "../../../../db/types";
import {BotClient} from "../../../../whatsapp_bot";
import {logger} from "../../../../logger";

export default class KickCommand extends Command {
    private language: typeof languages.commands.kick[Language];

    constructor(language: Language) {
        const langs = languages.commands.kick;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            description: lang.description,
            extendedDescription: lang.extended_description,
            groupLevel: "ADMIN",
            blockedChats: ["DM"],
        });

        this.language = lang;
    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        const adminMap = await getGroupPrivilegeMap(client, message.to);
        const senderPrivilegeLevel = adminMap[message.from];
        const iAmAdmin: boolean = adminMap[BotClient.currentClientId!] > 0;

        if (!iAmAdmin) {
            return await message.reply(this.language.execution.bot_no_admin, true);
        } else if (!message.raw) {
            return await message.reply("There seems to have been an error. Please try again.", true);
        }

        const kickListSet = new Set<string>();
        const kickList: string[] = [];
        (message.raw.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? []).forEach((kick: string) =>
            kickListSet.add(kick),
        );
        if (!kickListSet || kickListSet.size == 0) {
            return await message.reply(this.language.execution.no_tag, true);
        }

        let attemptedSameLevelKick = false;
        const kickIncludesBot = kickList.includes(BotClient.currentClientId!);
        for (const kick of kickListSet) {
            if (adminMap[kick] >= senderPrivilegeLevel) {
                attemptedSameLevelKick = true;
                continue;
            }

            kickList.push(kick);
        }

        let errorMessage = "";
        if (kickIncludesBot) errorMessage += this.language.execution.self_kick;
        if (attemptedSameLevelKick)
            errorMessage += kickIncludesBot
                ? `\n${this.language.execution.kick_admin[0]}`
                : this.language.execution.kick_admin[1];

        if (kickIncludesBot || attemptedSameLevelKick) {
            return await message.reply(errorMessage, true, {
                placeholder: {chat, command: this},
            });
        }

        let failedList: Array<string> = [];
        for (const number of kickList) {
            try {
                await client.groupParticipantsUpdate(message.to, [number], "remove");
            } catch (error) {
                logger.error(error);
                failedList.push(number);
            }
        }

        if (failedList.length > 0) {
            return message.reply(this.language.execution.failed, true, {
                placeholder: {
                    custom: new Map([["list", failedList.join(", ")]]),
                },
            });
        }

        await message.reply(this.language.execution.success, true);
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {
        switch (blockedReason) {
            case BlockedReason.InsufficientGroupLevel:
                return data.reply(this.language.execution.not_admin, true);
            case BlockedReason.BlockedChat:
                return data.reply(this.language.execution.not_group);
            default:
                return;
        }
    }
}
