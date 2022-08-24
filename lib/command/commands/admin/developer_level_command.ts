import {isJidUser, WASocket} from "@adiwajshing/baileys";
import {AccountType, Chat, User} from "@prisma/client";
import {BlockedReason} from "../../../blockable";
import {prisma} from "../../../db/client";
import Message from "../../../messaging/message";
import {fullEnumSearch} from "../../../utils/enum_utils";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";

export default class DeveloperLevelCommand extends Command {
    constructor() {
        super({
            triggers: ["developer level", "dev level", "promote dev", "promote developer"].map(
                (e) => new CommandTrigger(e),
            ),
            accountType: AccountType.ADMIN,
            usage: "{prefix}{command}",
            category: "Bot Operator",
            description: "Give a user a certain privilege level",
        });
    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        const splitBody = body?.split(" ");
        const accountTypes = Object.keys(this.accountType).reverse() as (keyof typeof AccountType)[];
        let query: string | number | undefined = splitBody?.shift()?.trim().toLowerCase();
        query = Number(query) === NaN ? query : Number(query);
        const level = accountTypes.find((e, i) => query === e.toLowerCase() || query === i + 1);

        if (!level) {
            const privilegesText = Array.from(Array.from(accountTypes).keys())
                .map((key) => `*${key}*. ${accountTypes[key]}`)
                .join("\n");
            return message.reply(
                `Please provide the privilege level the users should be promoted to.\n\n${privilegesText}`,
                true,
            );
        }

        const mentionedSet = new Set<string>();
        (message.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? []).forEach((mention: string) =>
            mentionedSet.add(mention),
        );
        if (mentionedSet.size === 0) {
            return message.reply("Please tag those you want to promote.");
        }

        await prisma.user.updateMany({
            where: {
                OR: Array.from(mentionedSet)
                    .filter(isJidUser)
                    .map((mention) => ({
                        jid: mention,
                    })),
            },
            data: {accountType: level},
        });
        for (const mention of mentionedSet) {
            if (!isJidUser(mention)) continue;
        }

        await message.reply(`Updated the privilege level of all users tagged to ${level}`);
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
