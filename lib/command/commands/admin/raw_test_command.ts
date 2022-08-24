import {WASocket} from "@adiwajshing/baileys";
import {BlockedReason} from "../../../blockable/blocked_reason";
import Message from "../../../../lib/messaging/message";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";
import {AccountType, Chat, User} from "@prisma/client";

export default class RawCommand extends Command {
    constructor() {
        super({
            triggers: [new CommandTrigger("raw")],
            accountType: AccountType.ADMIN,
            usage: "{prefix}{command}",
            category: "Bot Operator",
            description: "Sends a raw message",
        });
    }

    async onBlocked(message: Message, blockedReason: BlockedReason) {
        switch (blockedReason) {
            case BlockedReason.BadAccountType:
                await message.reply("You must be a system admin to use this command.", true);
            default:
                return;
        }
    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        await client.sendMessage(message.raw?.key.remoteJid!, {text: body || "ahhhhhhh"});
        await client.sendMessage(message.raw?.key.remoteJid!, {text: body || "ahhhhhhh"}, {quoted: message.raw});
        await client.sendMessage(message.raw?.key.remoteJid!, {text: body || "ahhhhhhh"}, {quoted: message.raw});
    }
}
