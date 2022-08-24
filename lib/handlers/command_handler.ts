import {isJidGroup, isJidUser} from "@adiwajshing/baileys";
import {whatsappBot} from "..";
import Blockable from "../blockable/blockable";
import {BlockedReason} from "../blockable/blocked_reason";
import Triggerable from "../blockable/triggerable";
import {Command, CommandTrigger} from "../command";
import Message from "../../lib/messaging/message";
import {getUserPrivilegeLevel} from "../utils/group_utils";
import {Chat} from "@prisma/client";
import {getNumberFromAccountType, getNumberFromGroupLevel} from "../utils/utils";
import {prisma} from "../db/client";
import { getCooldownLeft } from "../user/user";

export default class CommandHandler {
    public commands: Command[];

    constructor() {
        this.commands = [];
    }

    find(data: Message, chat: Chat): [CommandTrigger, Command][] | Promise<[CommandTrigger, Command][]> {
        return this.findByContent(data.content ?? "", chat.prefix);
    }

    findByContent(content: string, prefix: string): [CommandTrigger, Command][] | Promise<[CommandTrigger, Command][]> {
        const result: [CommandTrigger, Command][] = [];

        for (const blockable of this.commands) {
            let foundTrigger: CommandTrigger | undefined = undefined;

            for (const trigger of blockable.triggers) {
                const checkedData = content?.slice(prefix.length) ?? "";

                if (!trigger.isTriggered(checkedData)) continue;
                foundTrigger = trigger;
                break;
            }

            if (!foundTrigger) continue;
            result.push([foundTrigger, blockable]);
        }

        return result;
    }

    appliable(data: Message, prefix: string): boolean | Promise<boolean> {
        return data.content?.startsWith(prefix) ?? false;
    }

    async isBlocked(
        data: Message,
        chat: Chat,
        blockable: Command,
        checkCooldown: boolean,
        trigger?: CommandTrigger | undefined,
    ): Promise<BlockedReason | undefined> {
        const res = await this.isBlockedCheck(data, chat, blockable, checkCooldown, trigger);

        return res;
    }

    async isBlockedCheck(
        message: Message,
        chat: Chat,
        blockable: Command,
        checkCooldown: boolean = true,
        trigger?: CommandTrigger,
    ): Promise<BlockedReason | undefined> {
        if (!(blockable instanceof Command)) return -1;
        if (trigger && !(trigger instanceof CommandTrigger)) return -1;

        const checkedPerms = await messagePermissionsCheck(blockable, message);
        if (checkedPerms != undefined) return checkedPerms;

        const usedTrigger = trigger ?? blockable.mainTrigger;
        const body = message.content?.slice(chat.prefix.length + usedTrigger.command.length + 1) ?? "";
        const args = body.split(" ");
        if (args && args.length < blockable.minArgs) {
            return BlockedReason.InsufficientArgs;
        }

        const user =
            message.senderJid &&
            (await prisma.user.findUnique({where: {jid: message.senderJid}, include: {cooldowns: true}}));
        if (!user) return;

        if (checkCooldown) {
            const cooldownLeft = getCooldownLeft(user, blockable.mainTrigger);

            if (cooldownLeft > 0) {
                return BlockedReason.Cooldown;
            }
        }
    }

    add(...commands: Command[]): void {
        this.commands.push(...commands);
    }
}

export const messagePermissionsCheck = async (blockable: Blockable<Message>, message: Message) => {
    if (blockable.blockedChats.includes("GROUP") && isJidGroup(message.raw?.key.remoteJid!)) {
        return BlockedReason.BlockedChat;
    }

    if (blockable.blockedChats.includes("DM") && isJidUser(message.raw?.key.remoteJid!)) {
        return BlockedReason.BlockedChat;
    }

    if (blockable.blacklistedJids.length > 0) {
        if (blockable.blacklistedJids.includes(message.from)) {
            return BlockedReason.Blacklisted;
        }

        if (isJidGroup(message.to) && blockable.blacklistedJids.includes(message.to)) {
            return BlockedReason.Blacklisted;
        }
    }

    const gLevel = getNumberFromGroupLevel(blockable.groupLevel);
    if (isJidGroup(message.to) && gLevel > 0) {
        const level = await getUserPrivilegeLevel(whatsappBot.client!, message.to, message.from);
        if (level < gLevel) {
            return BlockedReason.InsufficientGroupLevel;
        }
    }

    const user = await prisma.user.findUnique({
        where: {
            jid: message.from,
        },
    });
    if (!user) {
        return BlockedReason.InvalidUser;
    }

    const accountLevel = getNumberFromAccountType(user.accountType);
    const accountLevelNeeded = getNumberFromAccountType(blockable.accountType);

    // TODO: Add chat level check
    // const chat = await chatRepository.get(message.to);
    if (accountLevelNeeded > 0 && accountLevel < accountLevelNeeded) {
        return BlockedReason.BadAccountType;
    }
};
