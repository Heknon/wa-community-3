import {AccountType, ChatType} from "@prisma/client";
import {BlockedReason} from "./blocked_reason";
import Triggerable from "./triggerable";
import {GroupLevel} from "../db/types";

/**
 * @template In data received from block
 */
export default interface Blockable<In> {
    triggers: Array<Triggerable<any>>;

    blockedChats: ChatType[];

    accountType: AccountType;

    groupAccountType: AccountType;

    groupLevel: keyof typeof GroupLevel;

    blacklistedJids: Array<string>;

    whitelistedJids: Array<string>;

    onBlocked(data: In, blockedReason: BlockedReason): Promise<any> | any;
}

export abstract class EmptyBlockable<In> implements Blockable<In> {
    triggers: Array<Triggerable<any>> = [];

    blockedChats: ChatType[] = [];

    accountType: AccountType = AccountType.USER;

    groupAccountType: AccountType = AccountType.USER;

    groupLevel: keyof typeof GroupLevel = GroupLevel.USER;

    blacklistedJids: Array<string> = [];

    whitelistedJids: Array<string> = [];

    abstract onBlocked(data: In, blockedReason: BlockedReason): Promise<any> | any;
}
