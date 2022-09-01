import {jidDecode, WASocket} from "@adiwajshing/baileys";
import Blockable from "../blockable/blockable";
import {BlockedReason} from "../blockable/blocked_reason";
import Message from "../../lib/messaging/message";
import CommandTrigger from "./command_trigger";
import {AccountType, ChatType} from "@prisma/client";
import {Chat, GroupLevel, User} from "../db/types";
import type { Placeholder } from "../messaging/types";

export default abstract class Command implements Blockable<Message> {
    triggers: CommandTrigger[];

    announcedAliases: string[];

    blockedChats: ChatType[];

    accountType: AccountType;

    groupAccountType: AccountType | 'blocked';

    blacklistedJids: string[];

    whitelistedJids: string[];

    minArgs: number;

    usage: string;

    name: string;

    category: string | undefined;

    description: string;

    extendedDescription: string;

    cooldowns: Map<AccountType, number>;

    groupLevel: keyof typeof GroupLevel;

    constructor({
        triggers,
        blockedChats = [],
        accountType = AccountType.USER,
        groupAccountType,
        blacklistedJids = [],
        whitelistedJids = [],
        minArgs = 0,
        usage = "{prefix}{command}",
        description = "",
        name,
        cooldowns = new Map([
            [AccountType.USER, 2000],
            [AccountType.DONOR, 1000],
            [AccountType.SPONSOR, 500],
            [AccountType.MODERATOR, 500],
            [AccountType.DEVELOPER, 0],
            [AccountType.ADMIN, 0],
        ]),
        groupLevel = GroupLevel.USER,
        category = undefined,
        extendedDescription = "",
        announcedAliases,
    }: {
        triggers: CommandTrigger[];
        blockedChats?: ChatType[];
        accountType?: AccountType;
        groupAccountType?: AccountType | 'blocked';
        blacklistedJids?: string[];
        whitelistedJids?: string[];
        minArgs?: number;
        name?: string;
        usage?: string;
        description?: string;
        cooldowns?: Map<AccountType, number>;
        groupLevel?: keyof typeof GroupLevel;
        category?: string;
        extendedDescription?: string;
        announcedAliases?: string[];
    }) {
        this.triggers = triggers;
        this.blockedChats = blockedChats;
        this.accountType = accountType;
        this.groupAccountType = groupAccountType ?? accountType;
        this.blacklistedJids = blacklistedJids;
        this.whitelistedJids = whitelistedJids;
        this.minArgs = minArgs;
        this.usage = usage;
        this.description = description;
        this.cooldowns = cooldowns;
        this.groupLevel = groupLevel;
        this.category = category;
        this.extendedDescription = extendedDescription;
        this.announcedAliases = announcedAliases ?? this.triggers.map((e) => e.command);
        this.name = name ?? this.announcedAliases[0] ?? this.mainTrigger.command;
    }

    abstract execute(
        client: WASocket,
        chat: Chat,
        user: User,
        message: Message,
        body: string,
        trigger: CommandTrigger,
    ): Promise<any> | any;

    abstract onBlocked(message: Message, blockedReason: BlockedReason): Promise<any> | any;

    public get mainTrigger() {
        return this.triggers[0];
    }

    protected getDefaultPlaceholder({chat, message, user, custom}: Placeholder): Placeholder {
        const customPlaceholder = custom instanceof Map ? custom : custom ? new Map(Object.entries(custom)) : new Map();
        if (user) customPlaceholder.set("tag", `@${jidDecode(user.jid)?.user}`);

        return {
            chat,
            message,
            command: this,
            user,
            custom: customPlaceholder,
        };
    }

    /**
     *
     * @param placeholder placeholder to mutate
     * @param custom added palceholders
     */
    protected addCustomPlaceholders(placeholder: Placeholder, custom: Map<string, string> | {[key: string]: string}) {
        const customPlaceholder = custom instanceof Map ? custom : new Map(Object.entries(custom));
        if (!placeholder.custom) placeholder.custom = new Map();
        if (!(placeholder.custom instanceof Map)) placeholder.custom = new Map(Object.entries(placeholder.custom));

        for (const [key, value] of customPlaceholder) {
            placeholder.custom?.set(key, value);
        }

        return placeholder;
    }
}
