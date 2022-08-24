import {isJidUser, jidDecode, WASocket} from "@adiwajshing/baileys";
import Message from "../../../../lib/messaging/message";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";
import {BlockedReason} from "../../../blockable";
import moment from "moment";
import languages from "../../../config/language.json";
import {Chat, User} from "../../../db/types";
import {prisma} from "../../../db/client";
import { createUser } from "../../../user/database_interactions";

export default class ReputationCommand extends Command {
    private language: typeof languages.commands.reputation[Language];

    constructor(language: Language) {
        const langs = languages.commands.reputation;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            description: lang.description,
            extendedDescription: lang.extended_description,
        });

        this.language = lang;
    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        if (!message.senderJid) {
            return await message.reply("An error occurred while processing this message.", true);
        }

        const givenReps = user.reputation?.reputationGiven || [];

        let userPointsCanGive = 3;
        // redact reputation point for each reputation given in the last 24 hours
        for (const rep of givenReps) {
            if (moment().diff(moment(rep.toISOString()), "hours") < 24) {
                userPointsCanGive--;
            }
        }

        userPointsCanGive = Math.max(0, userPointsCanGive);

        if (!body) {
            // send reputation info about sender user
            const userRep = user.reputation?.reputation ?? 0;
            return await message.reply(this.language.execution.self_stats, true, {
                placeholder: {
                    chat,
                    custom: new Map([
                        ["total", userRep.toString()],
                        ["left", userPointsCanGive.toString()],
                    ]),
                },
            });
        } else if (
            body.toLowerCase().startsWith("stats") ||
            body.toLowerCase().startsWith("סטטיסטיקה") ||
            body.toLowerCase().startsWith("statistics") ||
            body.toLowerCase().startsWith("stat")
        ) {
            const mentions = message.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
            const userStatToCheck = mentions.length > 0 ? mentions[0] : message.senderJid;
            let userChecked = await prisma.user.findUnique({
                where: {jid: userStatToCheck},
                include: {reputation: true},
            });
            if (!userChecked) {
                return await message.reply(this.language.execution.no_user, true);
            }

            return await message.replyAdvanced(
                {
                    text: this.language.execution.stats,
                    mentions: [userStatToCheck],
                },
                true,
                {
                    placeholder: {
                        chat,
                        custom: new Map([
                            ["total", (userChecked.reputation?.reputation ?? 0).toString()],
                            ["tag", `@${jidDecode(userStatToCheck)?.user}`],
                        ]),
                    },
                },
            );
        }

        const arg1 = body.split(" ")[0];
        const repPointsToGive = parseInt(arg1) === 0 ? 0 : parseInt(arg1) || 1;
        if (repPointsToGive != 0 && !repPointsToGive) {
            return await message.reply(this.language.execution.not_reputation_amount, true, {
                placeholder: {chat, custom: new Map([["text", arg1]])},
            });
        }

        const mentions = message.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
        if (mentions.length === 0) {
            return await message.reply(this.language.execution.no_mention, true);
        }

        const reppedJid = mentions[0];
        if (reppedJid == message.senderJid) {
            return await message.reply(this.language.execution.no_self_rep, true);
        }

        // if rep points is less than or equal to 0, don't give any reputation
        if (userPointsCanGive <= 0 || repPointsToGive > userPointsCanGive) {
            return await message.reply(this.language.execution.not_enough_rep, true, {
                placeholder: {
                    custom: new Map([
                        ["pointsGive", repPointsToGive.toString()],
                        ["pointsLeft", userPointsCanGive.toString()],
                    ]),
                },
            });
        }

        let reppedUser = await prisma.user.findUnique({where: {jid: reppedJid}, include: {reputation: true}});
        if (!reppedUser) {
            if (isJidUser(reppedJid)) {
                reppedUser = await createUser(reppedJid, '')
            }

            if (!reppedUser) {
                return await message.reply(this.language.execution.no_user, true);
            }
        }
        const previousRep = reppedUser.reputation?.reputation ?? 0;

        const reppedUserRep = await prisma.reputation.update({
            where: {userJid: reppedJid},
            data: {
                reputation: previousRep + repPointsToGive,
            },
        });

        const givingUserRep = await prisma.reputation.update({
            where: {userJid: message.senderJid},
            data: {
                reputationGiven: {
                    push: [new Date()],
                },
            },
        });

        await message.replyAdvanced(
            {
                text: this.language.execution.success_give,
                mentions: [reppedJid],
            },
            true,
            {
                placeholder: {
                    custom: new Map([
                        ["previous", previousRep.toString()],
                        ["current", reppedUserRep.reputation.toString()],
                        ["given", repPointsToGive.toString()],
                        ["left", (userPointsCanGive - repPointsToGive).toString()],
                        ["tag", `@${jidDecode(reppedJid)?.user}`],
                    ]),
                },
            },
        );
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
