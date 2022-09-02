import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {CommandTrigger, EconomyCommand} from "../..";
import {BlockedReason} from "../../../blockable";
import {commas, getNumberFromAccountType} from "../../../utils/utils";
import languages from "../../../config/language.json";
import {Chat, User} from "../../../db/types";
import Message from "../../../messaging/message";
import {prisma, redis} from "../../../db/client";
import cuid from "cuid";
import {AccountType, Prisma} from "@prisma/client";
import {chatRankInclusion} from "../../../chat/database_interactions";

export default class GivePremiumCommand extends EconomyCommand {
    private language: typeof languages.commands.upgrade_group[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.upgrade_group;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
            usage: lang.usage,
            accountType: "SPONSOR",
            groupAccountType: "blocked",
            blockedChats: ["DM"],
        });

        this.language = lang;
        this.langCode = language;
    }

    async execute(
        client: WASocket,
        chat: Prisma.ChatGetPayload<{
            include: {
                chatRank: {
                    select: {
                        id: true;
                        gifter: {
                            select: {
                                jid: true;
                                phone: true;
                                accountType: true;
                            };
                        };
                    };
                };
            };
        }>,
        user: User,
        message: Message,
        body: string,
        trigger: CommandTrigger,
    ) {
        await message.reply(this.language.execution.interaction.message, true);
        const response = await this.validatedWaitForInteractionWith(
            message,
            () => {
                return message.reply(this.language.execution.interaction.message, true);
            },
            1000 * 50,
            () => {
                message.reply(languages.timeout[this.langCode], true);
            },
            "1",
            "2",
            "3",
            "4",
            "cancel",
            "בטל",
        );
        if (!response) return;

        const responseText = response.content
            ?.toLowerCase()
            .replace("cancel", "4")
            .replace("בטל", "4") as "1" | "2" | "3" | "4" | undefined;

        if (!responseText) return;
        if (responseText === "1") {
            const level = Math.min(
                getNumberFromAccountType(user.accountType),
                getNumberFromAccountType(AccountType.SPONSOR),
            );
            const chatLevel = getNumberFromAccountType(chat.chatRank?.gifter.accountType);

            if (chat.chatRank?.gifter.jid === user.jid) {
                return message.reply(this.language.execution.already_gifted, true);
            } else if (chat.chatRank?.gifter.jid != user.jid && level <= chatLevel) {
                return message.reply(this.language.execution.already_upgraded_by, true, {
                    placeholder: {
                        custom: {
                            upgrader: "@" + jidDecode(chat.chatRank?.gifter.jid)?.user!,
                        },
                    },
                    tags: [chat.chatRank?.gifter.jid!],
                });
            }

            if (user.giftedRanks.length >= 1 && user.accountType === "SPONSOR") {
                return message.reply(this.language.execution.too_many, true);
            }

            const updated = await prisma.chatRank.upsert({
                where: {
                    id: chat.chatRank?.id ?? cuid(),
                },
                update: {
                    gifter: {connect: {jid: user.jid}},
                },
                create: {
                    gifter: {connect: {jid: user.jid}},
                    giftedChat: {connect: {jid: chat.jid}},
                },
            });

            let text =
                (level > chatLevel
                    ? this.language.execution.upgrade_triumph
                    : this.language.execution.upgrade) +
                "\n\n" +
                this.language.execution.footer;
            await message.reply(text, true, {
                placeholder: {
                    custom: {
                        upgrader: "@" + user.phone,
                        previous: "@" + jidDecode(chat.chatRank?.gifter.jid)?.user ?? "",
                        level: level.toString(),
                    },
                },
            });
        } else if (responseText === "2") {
            if (!chat.chatRank || chat.chatRank.gifter.jid !== user.jid) {
                return message.reply(this.language.execution.not_gifter, true);
            }

            await prisma.chatRank.delete({
                where: {
                    id: chat.chatRank.id,
                },
            });

            return await message.reply(
                this.language.execution.downgrade + "\n\n" + this.language.execution.footer,
                true,
                {
                    placeholder: {
                        custom: {
                            level: "1"
                        }
                    }
                }
            );
        } else if (responseText === "3") {
            let text = this.language.execution.interaction.title + "\n\n";
            let i = 1;
            const subs = await Promise.all(
                user.giftedRanks.map((e) =>
                    client.groupMetadata(e.giftedChatJid).catch(() => undefined),
                ),
            );
            for (const gifted of user.giftedRanks) {
                text +=
                    this.language.execution.interaction.gc_format
                        .replace("{num}", i.toString())
                        .replace("{subject}", subs[i - 1]?.subject ?? gifted.giftedChatJid) + "\n";
                i++;
            }
            text += `*${i}.* ${this.language.execution.interaction.cancel}`;
            text.trimEnd();
            await message.reply(text, true);
            const result = await this.validatedWaitForInteractionWith(
                message,
                () => {
                    message.reply(text, true);
                },
                1000 * 50,
                () => {
                    message.reply(languages.timeout[this.langCode], true);
                },
                ...user.giftedRanks.map((e, i) => (i + 1).toString()),
                i.toString(),
            );

            if (!result) return;
            const resultText = result.content?.toLowerCase();
            if (!resultText) return;
            if (resultText === i.toString()) {
                return message.reply(this.language.execution.interaction.cancelled, true);
            }
            const num = Number(resultText);
            if (isNaN(num)) return;
            const gifted = user.giftedRanks[num - 1];
            if (!gifted) return;
            const chatGifted = await prisma.chat.findFirst({
                where: {
                    jid: gifted.giftedChatJid,
                },
                include: {
                    chatRank: chatRankInclusion,
                },
            });
            if (!chatGifted) return;
            return this.execute(client, chatGifted, user, result, body, trigger);
        } else if (responseText === "4") {
            return await message.reply(this.language.execution.interaction.cancelled, true);
        }
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {
        if (blockedReason == BlockedReason.BlockedChat) {
            data.reply(languages.onlygroups[this.langCode]);
        } else if (blockedReason == BlockedReason.BadAccountType) {
            data.reply(this.language.execution.not_donor, true);
        }
    }
}
