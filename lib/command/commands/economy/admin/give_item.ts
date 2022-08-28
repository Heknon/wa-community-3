import {WASocket} from "@adiwajshing/baileys";
import {AccountType, Chat} from "@prisma/client";
import {CommandTrigger, EconomyCommand} from "../../..";
import {BlockedReason} from "../../../../blockable";
import {prisma} from "../../../../db/client";
import {User} from "../../../../db/types";
import {getAllItems} from "../../../../economy/items";
import Message from "../../../../messaging/message";
import {getInventoryItem} from "../../../../user/inventory";
import cuid from "cuid";

export default class GiveItemCommand extends EconomyCommand {
    constructor() {
        super({
            triggers: ["give item"].map((trigger) => new CommandTrigger(trigger)),
            category: "Economy",
            description: "Give an item to a user",
            usage: "{prefix}{command} @mention",
            accountType: AccountType.ADMIN,
        });
    }

    async execute(
        client: WASocket,
        chat: Chat,
        executor: User,
        message: Message,
        body: string,
        trigger: CommandTrigger,
    ) {
        const mentions = message.mentions;
        const userJid = mentions.length > 0 ? mentions[0] : message.senderJid;
        if (!userJid) {
            return await message.reply("Must provide a user to give to.", true);
        }

        const item = getAllItems().find((e) => body.toLowerCase().indexOf(e.id.toLowerCase()) > -1);
        if (!item) {
            return message.reply("Please provide an item ID.");
        }

        const user = await prisma.user.findUnique({
            where: {jid: userJid},
            include: {
                items: true,
            },
        });
        if (!user) {
            return await message.reply(
                "The user you are trying to give an item to doesn't exist.",
                true,
            );
        }

        const invItem = getInventoryItem(user, item.id);
        const updatedUser = await prisma.inventoryItem.upsert({
            where: {
                id: invItem?.id ?? cuid(),
            },
            create: {
                itemId: item.id,
                user: {connect: {jid: userJid}},
                quantity: (invItem?.quantity || 0) + 1,
            },
            update: {
                quantity: (invItem?.quantity || 0) + 1,
            },
        });
        message.reply("Successfully gave item to user.", true);
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
