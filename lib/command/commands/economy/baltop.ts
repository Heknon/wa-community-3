import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {CommandTrigger, EconomyCommand} from "../..";
import {BlockedReason} from "../../../blockable";
import {commas} from "../../../utils/utils";
import languages from "../../../config/language.json";
import {Chat, User} from "../../../db/types";
import Message from "../../../messaging/message";
import {prisma, redis} from "../../../db/client";
import {userCalculateNetBalance} from "../../../user/user";
import {createUser} from "../../../user/database_interactions";
import {Prisma} from "@prisma/client";

type BaltopUserData = {
    jid: string;
    wallet: number;
    bank: number;
    phone: string;
    fakeid: string | undefined;
};

export default class BaltopCommand extends EconomyCommand {
    private language: typeof languages.commands.baltop[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.baltop;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
            usage: lang.usage,
            blockedChats: ["DM"],
        });

        this.language = lang;
        this.langCode = language;
    }

    private getBaltopKey(jid: string) {
        return `baltoptext:${jid}`;
    }

    async execute(
        client: WASocket,
        chat: Chat,
        user: User,
        message: Message,
        body: string,
        trigger: CommandTrigger,
    ) {
        // TODO: Make baltop paginated
        const redisKey = this.getBaltopKey(chat.jid);
        const cachedBaltopJson = await redis.get(redisKey);
        const cachedBaltop: BaltopUserData[] | undefined = cachedBaltopJson
            ? JSON.parse(cachedBaltopJson)
            : undefined;
        let baltop = cachedBaltop;

        if (!cachedBaltop || body.toLowerCase().includes("refresh") || body.toLowerCase().includes("רענון")) {
            const groupMeta = await client.groupMetadata(chat.jid);
            const usersTop = await prisma.user.findMany({
                where: {
                    jid: {in: groupMeta.participants.map((e) => e.id)},
                },
                select: {
                    jid: true,
                    phone: true,
                    money: {
                        select: {
                            bank: true,
                            wallet: true,
                        },
                    },
                    activeItems: {
                        select: {
                            itemId: true,
                            expire: true,
                            data: true,
                        },
                    },
                },
                take: 100,
            });

            baltop = usersTop.map((e) => {
                const fakeid = e.activeItems.find((e) => e.itemId === "fakeid");
                const expirationTime = new Date(
                    fakeid?.expire ?? Date.now() + 1000 * 60 * 60 * 24 * 5,
                );
                return {
                    jid: e.jid,
                    wallet: e.money?.wallet ?? 0,
                    bank: e.money?.bank ?? 0,
                    phone: e.phone,
                    fakeid:
                        new Date() < expirationTime && fakeid?.data
                            ? ((fakeid.data as Prisma.JsonObject).name as string | undefined)
                            : undefined,
                };
            });

            // sort baltop by total balance descending
            baltop = baltop.sort((a, b) => {
                return b.wallet + b.bank - (a.wallet + a.bank);
            });
            await redis.setex(redisKey, 60 * 10, JSON.stringify(baltop));
        }

        if (!baltop) return;
        const page = parseInt(body) || 1;
        const pageSize = 10;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const baltopPage = baltop.slice(start, end);
        const baltopPageText = baltopPage
            .map((e, i) => {
                const tag = e.fakeid ? `@${e.fakeid}` : "@" + e.phone;
                return this.language.execution.format
                    .replace("{num}", (start + i + 1).toString())
                    .replace("{tag}", tag)
                    .replace("{balance}", commas(e.wallet + e.bank));
            })
            .join("\n");

        const text = `${this.language.execution.title} (${page}/${Math.ceil(
            baltop.length / pageSize,
        )})\n${baltopPageText}\n\n${this.language.execution.footer}`;
        await message.reply(text, true, {
            tags: baltopPage.filter(e => e.fakeid == undefined).map((e) => {
                return e.jid;
            }),
        });
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {
        if (blockedReason == BlockedReason.BlockedChat) {
            data.reply(languages.onlygroups[this.langCode]);
        }
    }
}
