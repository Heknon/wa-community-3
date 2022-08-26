import {Chat, User} from "@prisma/client";
import moment, {Moment} from "moment";
import {Command} from "../command";
import Message from "../messaging/message";
import {redis, redisChatStats, redisCommandStats, redisUserStats} from "./client";

const sentAmount = (jid: User | Chat) => jidPrefix(jid.jid, "amountSent");
const sentLengths = (jid: User | Chat) => jidPrefix(jid.jid, "sentLengths");
const sentTimes = (jid: User | Chat) => jidPrefix(jid.jid, "sentTimes");
const processTimes = (jid: User | Chat) => jidPrefix(jid.jid, "processTimes");
const commandPrefix = (jid: User | Chat, command: Command) =>
    jidPrefix(jid.jid, `command:${command.mainTrigger.command}`);

export const statisticsToObject = async (): Promise<Statistics> => {
    const result = {
        chats: {},
        commands: {},
        users: {},
        messagesSent: 0,
        processTimes: [],
        messageLength: [],
    } as Statistics;
    const userKeys = await redisUserStats.keys("*");
    const chatKeys = await redisChatStats.keys("*");
    const commandKeys = await redisCommandStats.keys("*");

    for (const key of userKeys) {
        const keyType = getKeyType(key);
        const jid = getJidFromKey(key);
        if (!result["users"][jid]) {
            result["users"][jid] = {
                commands: {},
                messagesSent: 0,
            };
        }

        switch (keyType) {
            case "amountSent":
                const amntSent = await redisUserStats.get(key);
                result["users"][jid].messagesSent = parseInt(amntSent ?? "0");
                break;
            case "command":
                const command = key.split(":")[2];
                const commandCount = await redisUserStats.get(key);
                if (!result["users"][jid].commands) {
                    result["users"][jid].commands = {};
                }
                if (!result["users"][jid].commands[command]) {
                    result["users"][jid].commands[command] = {sent: 0};
                }
                result["users"][jid].commands[command].sent = parseInt(commandCount ?? "0");
                break;
            default:
                break;
        }
    }

    for (const key of chatKeys) {
        const keyType = getKeyType(key);
        const jid = getJidFromKey(key);
        if (!result["chats"][jid]) {
            result["chats"][jid] = {
                commands: {},
                messagesSent: 0,
            };
        }
        switch (keyType) {
            case "amountSent":
                const amntSent = await redisUserStats.get(key);
                result["chats"][jid].messagesSent = parseInt(amntSent ?? "0");
                break;
            case "command":
                const command = key.split(":")[2];
                const commandCount = await redisChatStats.get(key);
                if (!result["chats"][jid].commands) {
                    result["chats"][jid].commands = {};
                }
                if (!result["chats"][jid].commands[command]) {
                    result["chats"][jid].commands[command] = {sent: 0};
                }
                result["chats"][jid].commands[command].sent = parseInt(commandCount ?? "0");
                break;
            default:
                break;
        }
    }

    for (const key of commandKeys) {
        const keyType = getKeyType(key);
        const cmd = key.split(":")[1];
        if (!result["commands"][cmd]) {
            result["commands"][cmd] = {processTimes: [], sent: 0};
        }

        switch (keyType) {
            case "command_count":
                const amntSent = await redisCommandStats.get(key);
                result["commands"][cmd].sent = parseInt(amntSent ?? "0");
                break;
            case "command_process_time":
                const sentLengthsArr = (await redisCommandStats.lrange(key, 0, -1)).map((e) =>
                    parseInt(e),
                );
                result["commands"][cmd].processTimes = sentLengthsArr;
                break;
            default:
                break;
        }
    }

    result.processTimes = (await redis.lrange('stats:processTimes', 0, -1)).map((e) => parseInt(e));
    result.messagesSent = parseInt(await redis.get('stats:messagesSent') ?? "0");
    result.messageLength = (await redis.lrange('stats:msglength', 0, -1)).map((e) => parseInt(e));
    redis.set("stats:full", JSON.stringify(result));
    redis.set("stats:time", moment().toISOString());
    return result;
};

export const processMessageForStatistic = async (
    user: User,
    chat: Chat,
    message: Message,
    processTime: number,
    command?: Command,
) => {
    if (command) {
        redisCommandStats.incr("cmdcount:" + command.mainTrigger.command);
        redisCommandStats.lpush(`cmdprocess:${command.mainTrigger.command}`, processTime);
        redisUserStats.incr(commandPrefix(user, command));
        redisChatStats.incr(commandPrefix(chat, command));
    }

    redisUserStats.incr(sentAmount(user));

    redisChatStats.incr(sentAmount(chat));

    redis.lpush("stats:processTimes", processTime);
    redis.lpush("stats:msglength", message.content?.length ?? 0);
    redis.incr("stats:messagesSent");
};

const getKeyType = (key: string) => {
    if (key.indexOf("amountSent") > -1) {
        return "amountSent";
    } else if (key.indexOf("sentLengths") > -1) {
        return "sentLengths";
    } else if (key.indexOf("sentTimes") > -1) {
        return "sentTimes";
    } else if (key.indexOf("processTimes") > -1) {
        return "processTimes";
    } else if (key.indexOf("cmdprocess:") > -1) {
        return "command_process_time";
    } else if (key.indexOf("command:") > -1) {
        return "command";
    } else if (key.indexOf("cmdcount:") > -1) {
        return "command_count";
    } else {
        return "unknown";
    }
};

const getJidFromKey = (key: string) => {
    const parts = key.split(":");
    return parts[0];
};

export const jidPrefix = (id: string, suffix: string) => `${id}:${suffix}`;

export type Statistics = {
    messagesSent: number;
    messageLength: number[];
    processTimes: number[];
    chats: {
        [chatJid: string]: {
            messagesSent: number;
            commands: {
                [command: string]: {
                    sent: number;
                };
            };
        };
    };
    users: {
        [userJid: string]: {
            messagesSent: number;
            commands: {
                [command: string]: {
                    sent: number;
                };
            };
        };
    };
    commands: {
        [command: string]: {
            sent: number;
            processTimes: number[];
        };
    };
};
