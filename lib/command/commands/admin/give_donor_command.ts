import {S_WHATSAPP_NET, WASocket} from "@adiwajshing/baileys";
import {BlockedReason} from "../../../blockable";
import CommandTrigger from "../../command_trigger";
import InteractableCommand from "../../interactable_command";
import languages from "../../../config/language.json";
import moment from "moment";
import {AccountType, Chat, User} from "@prisma/client";
import Message from "../../../messaging/message";
import {rescueNumbers} from "../../../utils/regex_utils";
import {prisma} from "../../../db/client";
import {getNumberFromAccountType} from "../../../utils/utils";
import { messagingService } from "../../../messaging";

export default class GiveDonorCommand extends InteractableCommand {
    constructor() {
        const langs = languages.commands["give donor"];

        super({
            triggers: ["give donor"].map((e) => new CommandTrigger(e)),
            accountType: AccountType.ADMIN,
            usage: "{prefix}{command}",
            category: "Bot Operator",
            description: "Give a user a certain chat level",
            cooldowns: new Map(),
        });

    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        const donorNumberQuestion =
            "*What is the phone number of the donator?*\n_(Please mention or enter the phone number)_";

        let donorJid: string | undefined;
        let donor: User | undefined;
        await message.reply(donorNumberQuestion, true);
        const donorNumberMsg = await this.waitForInteractionWith(
            message,
            async (msg) => {
                const body = msg.content;
                if (!body) return false;

                if (body.toLowerCase().trim().startsWith("cancel")) return true;

                const mentions = msg.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
                const phoneNumber = rescueNumbers(body);

                if (mentions && mentions.length > 0) {
                    donorJid = mentions[0];
                } else if (phoneNumber) {
                    donorJid = phoneNumber + S_WHATSAPP_NET;
                }

                if (!donorJid) return false;

                donor = (await prisma.user.findUnique({where: {jid: donorJid}})) ?? undefined;
                if (!donor) {
                    return false;
                }

                return true;
            },
            (msg) => message.reply(donorNumberQuestion, true),
            20 * 1000,
            () => message.reply("You took too long to respond. Please try again."),
        );
        if (!donorNumberMsg) return;

        if (!donorJid) {
            return await message.reply("You didn't enter a phone number.");
        }
        if (!donor) {
            return await message.reply("That user doesn't exist.");
        }

        let donorChatLevel: keyof typeof AccountType | undefined;
        const donorLevelText =
            "*What chat level do you want to set the donator as?*\n_(Please enter the chat level)_\n\n*0.* Free\n*1.* Donor\n*2.* Sponsor";
        await message.reply(donorLevelText, true);

        const donorLevelMsg = await this.waitForInteractionWith(
            message,
            async (msg) => {
                const body = msg.content;
                if (!body) return false;
                const splitBody = body?.split(" ");
                const accountTypes = Object.keys(AccountType).reverse() as (keyof typeof AccountType)[];
                let query: string | number | undefined = splitBody?.shift()?.trim().toLowerCase();
                query = Number(query) === NaN ? query : Number(query);
                const level = accountTypes.find((e, i) => query === e.toLowerCase() || query === i);
                if (getNumberFromAccountType(level) > getNumberFromAccountType(AccountType.SPONSOR)) {
                    return false;
                }

                if (donor?.accountType === level) {
                    await message.reply("That user already has that chat level.");
                    return true;
                }
                donorChatLevel = level;
                return true;
            },
            () => message.reply(donorLevelText, true),
            20 * 1000,
            () => message.reply("You took too long to respond. Please try again."),
        );

        if (!donorLevelMsg || !donorChatLevel) return;

        const howManyMonths =
            "*How many months do you want to give the donator?*\n_(Please enter the number of months)_";
        await message.reply(howManyMonths, true);
        let months: number | undefined;
        const monthsMsg = await this.waitForInteractionWith(
            message,
            async (msg) => {
                const body = msg.content;
                if (!body) return false;

                const monthsStr = body.replace(/\D*/g, "");
                if (!monthsStr) return false;
                months = Number(monthsStr);

                if (months < 1) {
                    return false;
                }

                return true;
            },
            () => message.reply(howManyMonths, true),
            20 * 1000,
            () => message.reply("You took too long to respond. Please try again."),
        );

        if (!monthsMsg) return;
        if (!months) {
            return await message.reply("You didn't enter a number.");
        }

        if (!donor) {
            return await message.reply("That user doesn't exist.");
        }

        await prisma.user.update({
            where: {
                jid: donorJid,
            },
            data: {
                accountType: donorChatLevel,
                accountTypeExpiration: moment().add(months, "months").toDate(),
            }
        });
        await message.reply(`${donor.name} has been given the chat level ${donorChatLevel}!`);

        const donorChat = await prisma.chat.findUnique({where: {jid: donorJid}});
        let lang: typeof languages.commands["give donor"][Language] | undefined;
        if (!donorChat || !donorChat.language) {
            lang = languages.commands["give donor"]["hebrew"];
        } else if (donorChat.language) {
            lang = languages.commands["give donor"][donorChat.language];
        }

        if (!lang) {
            lang = languages.commands["give donor"]["hebrew"];
        }

        await messagingService.sendMessage(donorJid!, {
            text: lang.execution.thanks.replace("{rank}", donorChatLevel ?? "USER"),
        });
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
