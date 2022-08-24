import {generateMessageID, WASocket} from "@adiwajshing/baileys";
import {BlockedReason} from "../../../blockable/blocked_reason";
import Message from "../../../../lib/messaging/message";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";
import {AccountType, Chat, User} from "@prisma/client";

export default class JIDCommand extends Command {
    constructor() {
        super({
            triggers: [new CommandTrigger("jid")],
            accountType: AccountType.ADMIN,
            usage: "{prefix}{command}",
            category: "Bot Operator",
            description: "Gives you the JID of the chat the command was sent in.",
        });
    }

    async onBlocked(msg: Message, blockedReason: BlockedReason) {
        switch (blockedReason) {
            case BlockedReason.BadAccountType:
                await msg.reply("You must be a system admin to use this command.", true);
            default:
                return;
        }
    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        const quoted = message.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quoted) {
            return await message.reply(
                `CHAT JID: ${message.raw?.key.remoteJid ?? "N/A"}\nCURRENT MESSAGE ID: ${
                    message.raw?.key.id ?? "N/A"
                }\nMIME TYPE: ${quoted.videoMessage?.mimetype ?? "N/A"}\nMIME TYPE: ${
                    quoted.imageMessage?.mimetype ?? "N/A"
                }\nMIME TYPE: ${quoted.stickerMessage?.mimetype ?? "N/A"}\nMIME TYPE: ${
                    quoted.stickerMessage?.url ?? "N/A"
                }`,
                true,
            );
        }

        await message.reply(`JID: ${message.raw?.key.remoteJid ?? "N/A"}`, true);
    }
}
