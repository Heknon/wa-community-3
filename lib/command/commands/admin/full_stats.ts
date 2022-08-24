import {isJidGroup, isJidUser, WASocket} from "@adiwajshing/baileys";
import {AccountType, Chat, User} from "@prisma/client";
import moment from "moment";
import {BlockedReason} from "../../../blockable";
import { prisma } from "../../../db/client";
import Message from "../../../messaging/message";
import {fullEnumSearch} from "../../../utils/enum_utils";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";

type AdvancedStats = {
    messagesSent: number;
    messagesSentData: moment.Moment[];
    commandsSent: number;
    commandsSentData: {
        [key: string]: moment.Moment[];
    };
};

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

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        // const statistics = (await prisma.find<Map<string, any>>({}).toArray()).map((e) =>
        //     Statistics.fromMap(e),
        // );

        // const userStatsMap = new Map<string, AdvancedStats>();
        // const chatStatsMap = new Map<string, AdvancedStats>();
        // const overallStats: AdvancedStats = {
        //     commandsSent: 0,
        //     commandsSentData: {},
        //     messagesSent: 0,
        //     messagesSentData: [],
        // };

        // for (const jidStats of statistics) {
        //     const chatJid = jidStats.jid;
        //     const chatStats = chatStatsMap.get(chatJid);
        //     if (!chatStats && isJidGroup(chatJid)) {
        //         chatStatsMap.set(chatJid, {
        //             commandsSent: 0,
        //             commandsSentData: {},
        //             messagesSent: 0,
        //             messagesSentData: [],
        //         });
        //     }

        //     for (const [userJid, messageTimes] of Array.from(jidStats.messagesSent.entries()) as [
        //         string,
        //         moment.Moment[],
        //     ][]) {
        //         const userStats = userStatsMap.get(userJid);
        //         if (!userStats) {
        //             userStatsMap.set(userJid, {
        //                 commandsSent: 0,
        //                 commandsSentData: {},
        //                 messagesSent: 0,
        //                 messagesSentData: [],
        //             });
        //         }
        //         const userStatsData = userStatsMap.get(userJid);
        //         userStatsData!.messagesSent += messageTimes.length;
        //         userStatsData!.messagesSentData.push(...messageTimes.map((e) => moment(e)));

        //         overallStats.messagesSent += messageTimes.length;
        //         if (chatStats) chatStats.messagesSent += messageTimes.length;
        //         overallStats.messagesSentData.push(...messageTimes.map((e) => moment(e)));
        //         if (chatStats) chatStats.messagesSentData.push(...messageTimes.map((e) => moment(e)));
        //     }

        //     for (const [userJid, commandData] of Array.from(jidStats.commandsSent.entries()) as [
        //         string,
        //         [string, moment.Moment][],
        //     ][]) {
        //         const userStats = userStatsMap.get(userJid);

        //         if (!userStats) {
        //             userStatsMap.set(userJid, {
        //                 commandsSent: 0,
        //                 commandsSentData: {},
        //                 messagesSent: 0,
        //                 messagesSentData: [],
        //             });
        //         }

        //         for (const [command, cmdTime] of commandData) {
        //             const userStatsData = userStatsMap.get(userJid);
        //             userStatsData!.commandsSent += 1;
        //             overallStats.commandsSent += 1;
        //             if (chatStats) chatStats.commandsSent += 1;

        //             if (!userStatsData!.commandsSentData[command]) {
        //                 userStatsData!.commandsSentData[command] = [];
        //             }
        //             if (!overallStats.commandsSentData.hasOwnProperty(command)) {
        //                 overallStats.commandsSentData[command] = [];
        //             }
        //             if (chatStats && !chatStats.commandsSentData.hasOwnProperty(command)) {
        //                 chatStats.commandsSentData[command].push(moment(cmdTime));
        //             }
        //             userStatsData!.commandsSentData[command].push(moment(cmdTime));
        //             overallStats.commandsSentData[command].push(moment(cmdTime));
        //         }
        //     }
        // }

        // const amountOfUsers = await usersCollection.countDocuments();
        // const amountOfChats = await chatsCollection.countDocuments();
        // const activeUsers = await userRepository.getAll();
        // const activeChats = await chatRepository.getAll();
        // const sortedOverallCommands = Object.entries(overallStats.commandsSentData).sort(
        //     (a, b) => b[1].length - a[1].length,
        // );

        // console.log(BotClient.currentClientId);
        // const overallStatsMessage = `*Overall stats:*\n\nCommands sent: ${overallStats.commandsSent}\nMessages sent: ${
        //     overallStats.messagesSent
        // }\nMessages sent by bot: ${userStatsMap.get(BotClient.currentClientId!)?.messagesSent}\nCommands/Message: %${(
        //     (overallStats.commandsSent / overallStats.messagesSent) *
        //     100
        // ).toFixed(
        //     3,
        // )}\n\nUsers: ${amountOfUsers} registered users\nChats: ${amountOfChats} registered chats\nActive Users (Current session): ${
        //     activeUsers.length
        // }\nActive Chats (Current session): ${activeChats.length}\n\n*Commands performace:*${sortedOverallCommands
        //     .map(([command, times]) => `\n${command}: ${times.length}`)
        //     .join("\n")}`;
        // const commandsMadeLast10Minutes = Array.from(
        //     this.getCommandsMadeLastMinutes(10, sortedOverallCommands).entries(),
        // ).sort((a, b) => b[1] - a[1]);
        // const last10Minutes = `*Commands last 10 minutes:*\n\n${commandsMadeLast10Minutes
        //     .map(([command, count]) => `${command}: ${count}`)
        //     .join("\n")}`;

        // await message.reply(overallStatsMessage, true);
        // await message.reply(last10Minutes, true);
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}

    private getCommandsMadeLastMinutes(time: number, commandsData: [string, moment.Moment[]][]) {
        const commandsMadeLastMinutes = new Map<string, number>();
        const timeAtPrev = moment().subtract(time, "minutes");

        for (const [command, times] of commandsData) {
            const amount = times.filter((e) => e.isAfter(timeAtPrev)).length;
            if (amount) commandsMadeLastMinutes.set(command, amount);
        }

        return commandsMadeLastMinutes;
    }
}
