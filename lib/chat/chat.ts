import {whatsappBot} from "..";
import {BlockedReason} from "../blockable";
import {Command, commandHandlerStore, CommandTrigger} from "../command";
import Message from "../messaging/message";
import languages from "../config/language.json";
import config from "../config/config.json";
import {Chat as FullChat, User} from "../db/types";
import {pluralForm} from "../utils/message_utils";
import {
    addCommandCooldown,
    getCooldownLeft,
    getUserRandom,
    removeCommandCooldown,
} from "../user/user";
import {isJidGroup, isJidUser} from "@adiwajshing/baileys";
import {prisma, redis, redisAlerts} from "../db/client";
import {AccountType, BotResponse, Chat} from "@prisma/client";
import moment from "moment";
import "moment-duration-format";
import {messagingService} from "../messaging";

export const handleChatMessage = async (message: Message, sender: User, chat: FullChat) => {
    if (message.fromBot) return;
    const handler = commandHandlerStore.getHandler(chat.language);
    const foundCommands = await handler.find(message, chat);
    const foundResponses = findValidBotResponses(message, sender, chat);

    if (foundResponses.length > 0 && foundCommands.length === 0) {
        const random = getUserRandom(sender);
        const response = foundResponses[random.intBetween(0, foundResponses.length - 1)];
        const responseText =
            response.responses[random.intBetween(0, response.responses.length - 1)];
        message.reply(responseText, true);
        return;
    }

    if (foundCommands.length > 0) {
        await processMessageForDonorAlerts(sender, chat);
    }

    for (const [trigger, blockable] of foundCommands) {
        const isBlocked = await handler.isBlocked(message, chat, blockable, true, trigger);

        if (isBlocked == BlockedReason.Cooldown) {
            const timeToWait = (await getCooldownLeft(sender.jid, blockable.mainTrigger)) / 1000.0;
            const donateCommand = await getCommandByTrigger(chat, "donate");
            const isShortWait = timeToWait < 60 * 10;
            const text = isShortWait
                ? languages.cooldown[chat.language].message
                : languages.cooldown[chat.language].long;

            await message.replyAdvanced(
                {
                    text,
                    buttons: [
                        {
                            buttonId: "0",
                            buttonText: {
                                displayText: `${chat.prefix}${donateCommand?.name}`,
                            },
                        },
                    ],
                },
                true,
                {
                    placeholder: {
                        custom: {
                            time: isShortWait
                                ? timeToWait.toString()
                                : moment
                                      .duration(timeToWait, "seconds")
                                      .format("d[d] h[h], m[m] s[s]"),
                            second: pluralForm(timeToWait, languages.times[chat.language].second),
                        },
                        chat: this,
                    },
                },
            );
        }

        if (isBlocked != undefined) {
            await blockable.onBlocked(message, isBlocked);
            return;
        }

        await executeCommand(trigger, blockable, message, sender, chat);
        return blockable;
    }
};

export const executeCommand = async (
    trigger: CommandTrigger,
    command: Command,
    message: Message,
    executor: User,
    chat: FullChat,
) => {
    const body = message.content?.slice(chat.prefix.length + trigger.command.length + 1) ?? "";
    // add command cooldown to user
    await addCommandCooldown(executor, command);
    const futureCmdRes = command.execute(
        whatsappBot.client!,
        chat,
        executor,
        message,
        body,
        trigger,
    );
    if (futureCmdRes instanceof Promise) {
        futureCmdRes.then(async (res) => {
            if (res === false) await removeCommandCooldown(executor, command);
            else await addCommandCooldown(executor, command);
        });
    }
};

export const processMessageForDonorAlerts = async (user: User, chat: FullChat) => {
    if (user.accountType !== AccountType.USER) return;

    await redisAlerts.incr(`${chat.jid}:commandsSent`);
    const commandsSentRaw = await redisAlerts.get(`${chat.jid}:commandsSent`);
    const commandsSent = parseInt(commandsSentRaw ?? "0", 10);
    const shouldSendDonorAlert = chat.type === "DM" ? commandsSent % 50 : commandsSent % 55;
    if (commandsSent === 0) return;

    if (shouldSendDonorAlert) {
        await messagingService.sendMessage(
            chat.jid,
            {
                text: languages.donate_alert[chat.language],
                buttons: [
                    {
                        buttonId: "0",
                        buttonText: {displayText: languages.donate_alert.button[chat.language]},
                    },
                ],
            },
            undefined,
            {
                placeholder: {
                    chat,
                },
            },
        );
    }
};

export const getCommandByTrigger = async (
    chat: Chat,
    trigger: string,
): Promise<Command | undefined> => {
    const handler = commandHandlerStore.getHandler(chat.language);
    if (!handler) return undefined;

    if (!trigger.startsWith(chat.prefix)) {
        trigger = chat.prefix + trigger;
    }

    const res = await handler.findByContent(trigger, chat.prefix);
    for (const [, blockable] of res) {
        if (blockable instanceof Command) {
            return blockable;
        }
    }
};

export const findValidBotResponses = (message: Message, sender: User, chat: FullChat) => {
    const foundResponses: BotResponse[] = [];
    const content = message.content?.toLowerCase().trim() ?? "";

    for (const response of chat.responses) {
        const filter = response.filter.toLowerCase().trim();
        if (response.includes && content.includes(filter)) {
            foundResponses.push(response);
        } else if (response.equals && content === filter) {
            foundResponses.push(response);
        } else if (response.startsWith && content.startsWith(filter)) {
            foundResponses.push(response);
        }
    }

    return foundResponses;
};
