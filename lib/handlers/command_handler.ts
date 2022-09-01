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
import {getCooldownLeft} from "../user/user";

export default class CommandHandler {
    public commands: Command[];

    constructor() {
        this.commands = [];
    }

    find(
        data: Message,
        chat: Chat,
    ): [CommandTrigger, Command][] | Promise<[CommandTrigger, Command][]> {
        return this.findByContent(data.content ?? "", chat.prefix);
    }

    findByContent(
        content: string,
        prefix: string,
    ): [CommandTrigger, Command][] | Promise<[CommandTrigger, Command][]> {
        const result: [CommandTrigger, Command, number][] = [];
        if (
            !content
                .slice(0, prefix.length + 2)
                .toLowerCase()
                .trim()
                .startsWith(prefix)
        ) {
            return result.map(([trigger, command, num]) => [trigger, command]);
        }

        for (const blockable of this.commands) {
            let foundTrigger: CommandTrigger | undefined = undefined;
            let length = 0;

            for (const trigger of blockable.triggers) {
                const checkedData = content?.slice(prefix.length) ?? "";

                if (!trigger.isTriggered(checkedData)) continue;
                foundTrigger = trigger;
                length = trigger.characterMatch(checkedData);
                break;
            }

            if (!foundTrigger) continue;
            result.push([foundTrigger, blockable, length]);
        }

        // sort by length descending
        result.sort((a, b) => b[2] - a[2]);
        return result.map(([trigger, command, num]) => [trigger, command]);
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
        const body =
            message.content?.slice(chat.prefix.length + usedTrigger.command.length + 1) ?? "";
        const args = body.split(" ");
        if (args && args.length < blockable.minArgs) {
            return BlockedReason.InsufficientArgs;
        }

        if (!message.senderJid) return;

        if (checkCooldown) {
            const cooldownLeft = await getCooldownLeft(message.senderJid, blockable.mainTrigger);

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

    const isGc = isJidGroup(message.jid);
    const chat = isGc
        ? await prisma.chat.findUnique({
              where: {jid: message.jid},
              include: {
                  chatRank: {
                      select: {
                          gifter: {
                              select: {
                                  accountType: true,
                              },
                          },
                      },
                  },
              },
          })
        : undefined;

    if (isGc && !chat) {
        return BlockedReason.InvalidChat;
    }

    const accountLevel = getNumberFromAccountType(user.accountType);
    const accountLevelNeeded = getNumberFromAccountType(blockable.accountType);

    if (chat?.chatRank) {
        // if gifter has account level needed, so does group.
        const gcAccountLevel = getNumberFromAccountType(chat.chatRank.gifter.accountType);
        const gcAccountLevelNeeded = getNumberFromAccountType(blockable.groupAccountType);

        if (gcAccountLevelNeeded > 0 && gcAccountLevel < gcAccountLevelNeeded) {
            return BlockedReason.BadGroupAccountType;
        }
    }

    if (accountLevelNeeded > 0 && accountLevel < accountLevelNeeded) {
        return BlockedReason.BadAccountType;
    }
};
