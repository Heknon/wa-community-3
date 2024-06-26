import {BotClient} from "./whatsapp_bot";
import {BaileysEventEmitter, Chat as WAChat, isJidUser, proto} from "@adiwajshing/baileys";
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
import ffmpeg from "fluent-ffmpeg";
import dotenv from "dotenv";
import {normalizeJid} from "./utils/group_utils";
import moment from "moment";
import {EveryoneCommand, HelpCommand} from "./command/commands";
import {logger} from "./logger";
import on_death from "death";
import {messagingService} from "./messaging";
import {prisma} from "./db/client";
import config from "./config/config.json";
import languages from "./config/language.json";
import {getCommandByTrigger, handleChatMessage} from "./chat/chat";
import {createUser, getFullUser} from "./user/database_interactions";
import {
    chatRankInclusion,
    createChat,
    doesChatExist,
    getFullChat,
} from "./chat/database_interactions";
import {processMessageForStatistic} from "./db/statistics";
import {disclaimerService} from "./disclaimer_service";
import { wait } from "./utils/async_utils";

ffmpeg.setFfmpegPath(ffmpegPath);
dotenv.config({path: "./"});
export const whatsappBot: BotClient = new BotClient(registerEventHandlers);
export const SAFE_DEBUG_MODE = false;
export const ALLOWED_DEBUG_JIDS = ["972557223809@s.whatsapp.net", "120363041344515310@g.us"];

whatsappBot.start();

let messageNumber = 0;
function registerEventHandlers(eventListener: BaileysEventEmitter, bot: BotClient) {
    eventListener?.on("messages.upsert", async (chats) => {
        for (const rawMsg of chats.messages) {
            let recvTime = Date.now();
            // if (rawMsg.messageTimestamp ?? 0 < moment().unix() - 60) return;
            // if not actual message return
            if (rawMsg.message?.protocolMessage) return;

            // mutates rawMsg key to a fixed version. current state of key has bugs.
            messageKeyFix(rawMsg);

            // // apply metadata bound to message id in messaging service (this allows bot to send messages with metadata)
            const msg = await messagingService.messageInterceptor(rawMsg);
            const userJid = normalizeJid(msg.senderJid ?? "");
            if (SAFE_DEBUG_MODE && !ALLOWED_DEBUG_JIDS.some((e) => userJid == e)) return;

            logger.debug(
                `Processing message (${messageNumber++}) - (${moment
                    .unix(msg.timestamp)
                    .format("DD/MM/YYYY - HH:mm")}) ${msg.from} -> ${msg.to}}`,
            );

            const chatJid = normalizeJid(msg.raw?.key.remoteJid ?? "");
            if (!userJid) return; // if JID failed to normalize return
            if (!chatJid) return;

            const pushName = !msg.fromBot ? rawMsg.pushName ?? undefined : undefined; // if message is not from bot save with push name (WA name))
            let user = await fetchOrCreateUserFromJID(userJid, pushName);
            if (!user) return; // if user failed to fetch return

            // if pushName exists and current user name does not match pushName, update user name
            if (pushName && user.name != pushName) {
                await prisma.user.update({
                    where: {
                        jid: userJid,
                    },
                    data: {
                        name: pushName,
                    },
                });
            }

            // if ignore flag is set, return
            if (msg.metadata?.meta.get("ignore") == true) {
                return;
            }

            let chat = await getFullChat(chatJid);
            if (!chat) {
                try {
                    chat = await createChat(chatJid);
                } catch (e) {
                    logger.error(e);
                    chat = await getFullChat(chatJid);
                }
            }

            if (!chat) {
                return logger.error(`Failed to fetch chat.`, {jid: chatJid});
            }

            if (!chat.sentDisclaimer) {
                await disclaimerService.sendDisclaimer(chat);
            }

            const selectedRowId =
                rawMsg.message?.listResponseMessage?.singleSelectReply?.selectedRowId;
            if (selectedRowId && selectedRowId?.startsWith("HELP_COMMAND")) {
                const helpCommand = await getCommandByTrigger(chat, "help");
                let splitAtNewLine = selectedRowId.split("\n");
                splitAtNewLine.shift();
                let data = splitAtNewLine.join("\n").split("\n\r");
                const commandAliases = data[0].split("\n");
                const commandDescription = data[1];
                let id = 0;
                const aliasesButtons: proto.Message.ButtonsMessage.IButton[] = commandAliases.map(
                    (alias) => {
                        return {
                            buttonId: (id++).toString(),
                            buttonText: {
                                displayText: alias.replace(
                                    "{prefix}",
                                    chat?.prefix ?? config.default_command_prefix,
                                ),
                            },
                        };
                    },
                );

                return await messagingService.replyAdvanced(
                    msg,
                    {
                        text: `*${
                            aliasesButtons[0].buttonText?.displayText ?? ""
                        }*\n\n${commandDescription}`,
                        buttons: aliasesButtons,
                        footer: `(${chat.prefix}${
                            helpCommand?.name ?? "help"
                        } ${aliasesButtons[0].buttonText?.displayText?.replace(
                            chat.prefix ?? "",
                            "",
                        )})`,
                    },
                    true,
                );
            }

            if (
                msg.content?.includes("@everyone") ||
                msg.content?.includes("@כולם") ||
                msg.content?.includes("@here") ||
                msg.content?.includes("@כאן")
            ) {
                const everyoneCmd = (await getCommandByTrigger(
                    chat,
                    "everyone",
                )) as EveryoneCommand;
                if (!everyoneCmd) continue;
                await messagingService.replyAdvanced(
                    msg,
                    {
                        text: everyoneCmd.languageData.tip[everyoneCmd.languageCode],
                        buttons: [
                            {
                                buttonId: "0",
                                buttonText: {
                                    displayText: `${chat.prefix}${everyoneCmd.name}`,
                                },
                            },
                        ],
                    },
                    true,
                    {
                        placeholder: {
                            chat,
                        },
                    },
                );
            }
            if (
                msg.content?.toLowerCase().includes("prefix?") ||
                msg.content?.includes("קידומת?")
            ) {
                const helpCommand = await getCommandByTrigger(chat, "help");
                await messagingService.replyAdvanced(
                    msg,
                    {
                        text: `*${chat.prefix}*`,
                        buttons: [
                            {
                                buttonId: "0",
                                buttonText: {
                                    displayText: `${chat.prefix}${helpCommand?.name ?? "help"}`,
                                },
                            },
                        ],
                    },
                    true,
                );
            }

            const mentions = msg.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
            if (!msg.fromBot && mentions.includes(BotClient.currentClientId ?? "")) {
                const helpCommand = (await getCommandByTrigger(chat, "help")) as HelpCommand;

                await messagingService.replyAdvanced(
                    msg,
                    {
                        text: languages.tagged_info[chat.language].message,
                        buttons: [
                            // {
                            //     buttonId: "0",
                            //     buttonText: {
                            //         displayText: `${chat.prefix}${helpCommand.name} ${
                            //             languages.tagged_info[chat.language].text_version
                            //         }`,
                            //     },
                            // },
                            {
                                buttonId: "1",
                                buttonText: {
                                    displayText: `${chat.prefix}${helpCommand.name}`,
                                },
                            },
                        ],
                    },
                    true,
                    {
                        placeholder: {
                            chat,
                        },
                    },
                );
            }

            // if (msg.raw && msg.raw.key && msg.raw.key.remoteJid && msg.raw.key.id)
            //     await whatsappBot.client!.sendReceipt(
            //         msg.raw?.key.remoteJid,
            //         msg.raw?.key.participant ?? msg.raw?.key.remoteJid,
            //         [msg.raw?.key.id],
            //         'read'
            //     );
            const commandMade = await handleChatMessage(msg, user, chat).catch((e) => {
                logger.error(e.stack);
                return undefined;
            });
            let processedTime = Date.now();
            const processTime = processedTime - recvTime;
            processMessageForStatistic(user, chat, msg, processTime, commandMade);
            console.log(`Processed message in ${processTime}ms`);
        }
    });

    eventListener.on("groups.upsert", async (groups) => {
        for (const group of groups) {
            if (SAFE_DEBUG_MODE && !ALLOWED_DEBUG_JIDS.some((e) => e === group.id)) return;
            const chat = await getFullChat(group.id);
            if (!chat) {
                return;
            }

            if (chat.sentDisclaimer) {
                const langCode = chat.language;
                const helpCommand = (await getCommandByTrigger(chat, "help")) as HelpCommand;

                await wait(3000)
                await messagingService.sendMessage(
                    chat.jid,
                    {
                        text: languages.chat_upsert_help[langCode].help,
                        buttons: [
                            {
                                buttonText: {
                                    displayText: `${chat.prefix}${helpCommand.name}`,
                                },
                                buttonId: "0",
                            },
                        ],
                    },
                    {},
                    {
                        placeholder: {
                            chat,
                            command: await getCommandByTrigger(chat, "prefix"),
                        },
                    },
                );
            }
        }
    });
}

process.on("uncaughtException", async (err) => {
    logger.error("UNHANDLED EXCEPTION CAUGHT:");
    console.error(err);
    logger.error(err.stack);
    // await whatsappBot.restart();
});

on_death((sig) => {
    logger.info(`Received death signal ${sig}`);
    whatsappBot.close();
    prisma.$disconnect();
    process.exit(0);
});

export async function fetchOrCreateUserFromJID(jid: string, pushName?: string) {
    let user = await getFullUser(jid);

    if (isJidUser(jid) && !user) {
        try {
            user = await createUser(jid, pushName ?? "");
        } catch (e) {
            user = await getFullUser(jid);
        }

        if (!user) {
            logger.error(`Failed to get user with JID(${jid})`, {jid});
            return;
        }
    }

    return user;
}

/**
 * mutates message key to fixed version, removing colon from participant.
 * having colon in participant results in a mention bug to all iphones.
 * @param msg the message to mutate
 * @returns
 */
function messageKeyFix(msg: proto.IWebMessageInfo) {
    // fix mention bug on iphones where having ":" in participant mentions all iphones
    if (msg?.key?.participant?.includes(":") ?? false) {
        msg.key!.participant = msg?.key!.participant?.split(":")[0] + "@s.whatsapp.net";
    }

    if (msg?.participant?.includes(":") ?? false) {
        msg.participant = msg?.participant?.split(":")[0] + "@s.whatsapp.net";
    }
}
