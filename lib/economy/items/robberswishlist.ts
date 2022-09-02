import {Chat, User} from "../../db/types";
import Message from "../../messaging/message";
import Item from "./item";
import languages from "../../config/language.json";
import {whatsappBot} from "../..";
import {prisma, redis} from "../../db/client";
import {commas} from "../../utils/utils";
import {isJidGroup} from "@adiwajshing/baileys";
import { Prisma } from "@prisma/client";
import { hasActiveItemExpired } from "../utils";

export class RobbersWishlist extends Item {
    private static language = languages.items["robberswishlist"];

    public async use(chat: Chat, executor: User, message?: Message | undefined) {
        if (!isJidGroup(chat.jid)) {
            message?.reply(languages.onlygroups[chat.language], true);
            return false;
        }

        const redisText = await redis.get(`robberswishlist:${chat.jid}`);
        if (redisText) {
            message?.reply(redisText, true);
            return true;
        }

        const groupMeta = await whatsappBot.client?.groupMetadata(chat.jid);
        if (!groupMeta) {
            return false;
        }

        const participants: [string, string | undefined][] = groupMeta.participants.map((e) => [
            e.id,
            e.notify,
        ]);

        const users = await prisma.user.findMany({
            where: {
                jid: {in: participants.map((e) => e[0])},
                passive: false,
            },
            select: {
                jid: true,
                phone: true,
                money: true,
                passive: true,
                activeItems: {
                    select: {
                        itemId: true,
                        data: true,
                        expire: true,
                    },
                },
            },
            orderBy: {
                money: {
                    wallet: "desc",
                },
            },
            take: 100,
        });

        const userGetFakeId = (user: User) => {
            return user.activeItems.find((e) => e.itemId === "fakeid");
        };
        const stealList = users
            .map((e, i) => {
                const fakeid = userGetFakeId(e as any);
                const fakeIdExpired = hasActiveItemExpired(fakeid);
                const fakeIdName = !fakeIdExpired && fakeid ? (fakeid.data as Prisma.JsonObject)?.name : undefined
                return `*${i + 1}.* ${fakeIdName ?? e.phone} - ${commas(e.money?.wallet ?? 0)}`;
            })
            .join("\n");
        redis.setex(`robberswishlist:${chat.jid}`, 60 * 2, stealList);
        await message?.reply(RobbersWishlist.language[chat.language], true, {
            placeholder: {
                custom: {
                    list: stealList,
                },
            },
        });
        return true;
    }
}
