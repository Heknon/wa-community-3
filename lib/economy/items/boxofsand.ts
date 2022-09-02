import {Chat, User} from "../../db/types";
import Message from "../../messaging/message";
import Item from "./item";
import languages from "../../config/language.json";
import {waitForReply} from "../../utils/message_utils";
import {BotClient} from "../../whatsapp_bot";
import {prisma} from "../../db/client";
import {fetchOrCreateUserFromJID} from "../..";
import cuid from "cuid";
import {messagingService} from "../../messaging";
import moment from "moment";

export class BoxOfSand extends Item {
    private static language = languages.items["boxofsand"];

    public async use(chat: Chat, executor: User, message?: Message | undefined) {
        let mentions = message?.mentions ?? [];
        if (!message || mentions.length === 0) {
            const reply = await message?.reply(BoxOfSand.language.notag[chat.language], true);
            if (!reply) return false;

            const response = await waitForReply(
                executor.jid,
                reply?.jid,
                undefined,
                1000 * 30,
            ).catch((failed) => undefined);

            if (!response) return false;
            mentions = response.mentions;
            if (mentions.length === 0) return false;
        }

        if (mentions.length === 0) return false;

        const target = mentions[0];
        if (target === executor.jid) {
            await message?.reply(BoxOfSand.language.selftag[chat.language], true);
            return false;
        } else if (target == BotClient.currentClientId) {
            await message?.reply(BoxOfSand.language.bottag[chat.language], true);
            return false;
        }

        const user = await fetchOrCreateUserFromJID(target);
        if (!user) {
            await message?.reply(languages.notuser[chat.language], true);
            return false;
        }

        const active = user.activeItems.find((item) => item.itemId === "boxofsand");

        const in30minutes = moment().utc().add(30, "minutes").toDate();
        await prisma.activeItem.upsert({
            where: {
                id: active?.id ?? cuid(),
            },
            create: {
                itemId: "boxofsand",
                user: {connect: {jid: user.jid}},
                expire: in30minutes,
            },
            update: {
                expire: in30minutes,
            },
        });

        const targetChat = await prisma.chat.findUnique({where: {jid: target}});
        await message?.replyAdvanced(
            {text: BoxOfSand.language[chat.language], mentions: [user.jid]},
            true,
            {
                placeholder: {
                    custom: {
                        tag: "@" + user.phone,
                    },
                },
            },
        );
        if (targetChat?.sentDisclaimer) {
            await messagingService.sendMessage(
                targetChat.jid,
                {text: BoxOfSand.language.receiver[targetChat.language], mentions: [executor.jid]},
                undefined,
                {
                    placeholder: {
                        custom: {
                            tag: "@" + executor.phone,
                        },
                    },
                },
            );
        } else {
            await messagingService.sendMessage(
                chat.jid,
                {text: BoxOfSand.language.receiver[chat.language], mentions: [executor.jid]},
                undefined,
                {
                    placeholder: {
                        custom: {
                            tag: "@" + executor.phone,
                        },
                    },
                },
            );
        }
    }
}
