import {WASocket} from "@adiwajshing/baileys";
import {CommandTrigger, EconomyCommand} from "../../..";
import {BlockedReason} from "../../../../blockable";
import {prisma} from "../../../../db/client";
import {Chat, User} from "../../../../db/types";
import Message from "../../../../messaging/message";
import { createUser } from "../../../../user/database_interactions";
import {userCalculateNetBalance} from "../../../../user/user";
import {buildBalanceChangeMessage, extractNumbers} from "../utils";

export default class GiveBalanceCommand extends EconomyCommand {
    constructor() {
        super({
            triggers: ["give balance", "give bal"].map((trigger) => new CommandTrigger(trigger)),
            category: "Economy",
            description: "Give balance to a user",
            usage: "{prefix}{command} @mention",
            accountType: "ADMIN",
        });
    }

    async execute(
        client: WASocket,
        chat: Chat,
        user: User,
        message: Message,
        body: string,
        trigger: CommandTrigger,
    ) {
        const mentions = message.mentions;
        const userJid = mentions.length > 0 ? mentions[0] : message.senderJid;
        if (!userJid) {
            return await message.reply("Must provide a user to check their balance.", true);
        }

        // extract number from body using regex
        const number = Number(
            extractNumbers(body.replace("@" + userJid.split("@")[0], ""))[0] ?? "",
        );
        if (!number) {
            return await message.reply(
                `Must provide an amount to give.\nTry ${chat.prefix}give balance @mention <amount>`,
                true,
            );
        }

        let requestedUser = await prisma.user.findUnique({
            where: {jid: userJid},
            include: {money: true, items: true},
        });
        if (!requestedUser) {
            requestedUser = await createUser(userJid, "");
        } else if (!requestedUser.money) {
            return await message.reply("User does not have a balance.", true);
        }

        const previousBalance = requestedUser.money ?? undefined;
        const previousNet = await userCalculateNetBalance(requestedUser);
        const bankOrWallet = body.toLowerCase().includes("bank") ? "bank" : "wallet";

        const updatedBalance = await this.addBalance(requestedUser, {
            wallet: bankOrWallet === "bank" ? 0 : number,
            bank: bankOrWallet === "bank" ? number : 0,
        });
        if (!updatedBalance) {
            return await message.reply("Failed to give balance.", true);
        }

        requestedUser.money = updatedBalance;
        const currentNet = await userCalculateNetBalance(requestedUser);

        const balChangeMessage = buildBalanceChangeMessage(
            {wallet: previousBalance?.wallet, bank: previousBalance?.bank},
            requestedUser.money,
            previousNet,
            currentNet,
            "english",
        );
        const reply = `*@${userJid.split("@")[0]}'s balance*\n\n${balChangeMessage}`;
        return await message.replyAdvanced({text: reply, mentions: [userJid]}, true);
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
