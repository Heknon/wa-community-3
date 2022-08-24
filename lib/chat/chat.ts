import {whatsappBot} from "..";
import {BlockedReason} from "../blockable";
import {Command, commandHandlerStore, CommandTrigger} from "../command";
import Message from "../messaging/message";
import languages from "../config/language.json";
import config from "../config/config.json";
import {Chat as FullChat, User} from "../db/types";
import {pluralForm} from "../utils/message_utils";
import {addCommandCooldown, getCooldownLeft} from "../user/user";
import {isJidGroup, isJidUser} from "@adiwajshing/baileys";
import {prisma} from "../db/client";
import { Chat } from "@prisma/client";

export const handleChatMessage = async (message: Message, sender: User, chat: FullChat) => {
    if (message.fromBot) return;
    const handler = commandHandlerStore.getHandler(chat.language);

    const res = await handler.find(message, chat);
    for (const [trigger, blockable] of res) {
        const isBlocked = await handler.isBlocked(message, chat, blockable, true, trigger);

        if (isBlocked == BlockedReason.Cooldown) {
            const timeToWait = getCooldownLeft(sender, blockable.mainTrigger) / 1000.0;
            const donateCommand = await getCommandByTrigger(chat, "donate");
            await message.replyAdvanced(
                {
                    text: languages.cooldown[chat.language].message,
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
                            time: timeToWait.toString(),
                            second: pluralForm(timeToWait, languages.times[chat.language].second),
                        },
                        chat: this,
                    },
                },
            );
        }

        if (isBlocked != undefined) {
            return await blockable.onBlocked(message, isBlocked);
        }

        await executeCommand(trigger, blockable, message, sender, chat);
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
    command.execute(whatsappBot.client!, chat, executor, message, body, trigger);
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
