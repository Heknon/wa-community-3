import {WASocket} from "@adiwajshing/baileys";
import {BlockedReason} from "../../../blockable/blocked_reason";
import Message from "../../../../lib/messaging/message";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";
import {AccountType, Chat, User} from "@prisma/client";

export default class ShutdownCommand extends Command {
    constructor() {
        super({
            triggers: [new CommandTrigger("shutdown")],
            accountType: AccountType.ADMIN,
            usage: "{prefix}{command}",
            category: "Bot Operator",
            description: "Emergency shutdown of bot",
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
        await message.reply("Shutting down...", true);
        process.exit(0);
    }
}
