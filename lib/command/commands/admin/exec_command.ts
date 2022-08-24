import {WASocket} from "@adiwajshing/baileys";
import {BlockedReason} from "../../../blockable/blocked_reason";
import Message from "../../../../lib/messaging/message";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";
import {AccountType, Chat, User} from "@prisma/client";
import {logger} from "../../../logger";

export default class ExecCommand extends Command {
    constructor() {
        super({
            triggers: [new CommandTrigger("exec")],
            accountType: AccountType.ADMIN,
            usage: "{prefix}{command}",
            category: "Bot Operator",
            description: "Gotta test stuff live action style",
        });
    }

    async onBlocked(msg: Message, blockedReason: BlockedReason) {
        logger.warning("lol someone tried to use the exec command");
    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        await message.reply("*Result*:", true);
        await message.reply(await eval(body), true);
    }
}
