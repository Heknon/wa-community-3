import {isJidGroup, isJidUser, WASocket} from "@adiwajshing/baileys";
import {AccountType, Chat, User} from "@prisma/client";
import moment from "moment";
import {BlockedReason} from "../../../blockable";
import {prisma, redis, redisChatStats, redisCommandStats, redisUserStats} from "../../../db/client";
import {Statistics, statisticsToObject} from "../../../db/statistics";
import Message from "../../../messaging/message";
import {fullEnumSearch} from "../../../utils/enum_utils";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";

export default class FullStatsCommand extends Command {
    constructor() {
        super({
            triggers: ["full stats"].map((e) => new CommandTrigger(e)),
            accountType: AccountType.ADMIN,
            usage: "{prefix}{command}",
            category: "Bot Operator",
            description: "Get full stats of the bot",
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
        if (body.indexOf("clear") > -1) {
            redisChatStats.flushdb();
            redisUserStats.flushdb();
            redisCommandStats.flushdb()
            return;
        }

        const statsTimeRaw = await redis.get("stats:time");
        const statsTime = statsTimeRaw ? moment(statsTimeRaw) : undefined;
        if (
            !statsTime ||
            statsTime.isBefore(moment().subtract(1, "hour")) ||
            body.indexOf("force") > -1
        ) {
            await statisticsToObject();
        }

        const statsRaw = await redis.get("stats:full");
        if (!statsRaw) {
            return message.reply("An error occurred fetching session stats");
        }

        const stats = JSON.parse(statsRaw) as Statistics;
        const commandStats = Object.entries(stats.commands).map(([cmd, value]) => ({
            cmd,
            count: value.sent,
            avgProcessTime:
                value.processTimes.reduce((a, b) => a + b, 0) / value.processTimes.length,
        }));
        let commandStatsText = "*COMMANDS STATS*\n\n";
        for (const stat of commandStats) {
            commandStatsText += `*${stat.cmd}*: ${stat.count} - _Avg time: (${Math.round(
                stat.avgProcessTime,
            )}ms)_\n`;
        }
        if (commandStatsText.length === 0) {
            commandStatsText = "_No commands sent_";
        }
        await message.reply(commandStatsText, true);

        const averageResponseTime =
            stats.processTimes.reduce((a, b) => a + b, 0) / stats.processTimes.length;
        const averageMessageLength =
            stats.messageLength.reduce((a, b) => a + b, 0) / stats.messageLength.length;
        await message.reply(
            `*Average process time:* ${Math.round(
                averageResponseTime,
            )}ms\n*Messages received in session:* ${stats.messagesSent}\n*Chats in session:* ${
                Object.keys(stats.chats).length
            }\n*Users in session:* ${
                Object.keys(stats.users).length
            }\n*Average message length:* ${Math.round(averageMessageLength)} characters`,
            true,
        );
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
