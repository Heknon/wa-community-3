import {jidDecode, S_WHATSAPP_NET} from "@adiwajshing/baileys";
import {AccountType} from "@prisma/client";
import moment from "moment";
import VCard from "vcard-creator";
import {prisma} from "../db/client";
import {GroupLevel} from "../db/types";
import {rescueNumbers} from "./regex_utils";

/**
 * standardize means to set the tiem to 00-00-00 the start of a day
 * @param time moment to standardize
 */
export function standardizeMoment(time: moment.Moment) {
    const copy = moment(time);
    copy.set("minute", 0);
    copy.set("hour", 0);
    copy.set("second", 0);
    copy.set("millisecond", 0);
    return copy;
}

export async function buildVCardFromJID(jid: string): Promise<[VCard, string] | undefined> {
    jid = rescueNumbers(jid)[0] + S_WHATSAPP_NET;
    if (!jid || jid.length == 0) {
        return;
    }

    const user = await prisma.user.findUnique({where: {jid}});
    const vcard = new VCard();
    const name = user?.name?.split(" ") ?? [];
    const firstName = name.shift() ?? jidDecode(jid)!.user;
    const lastName = name.join(" ") ?? "";
    vcard.addName(lastName.length == 0 ? undefined : lastName, firstName);
    vcard.setProperty("TEL", `TEL;type=CELL;waid=${jidDecode(jid)!.user}`, `+${jidDecode(jid)!.user}`);

    return [vcard, user?.name ?? jidDecode(jid)?.user ?? ""];
}

export const commas = (number: number) => number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const getNumberFromGroupLevel = (level: keyof typeof GroupLevel) => {
    switch (level) {
        case GroupLevel.USER:
            return 0;
        case GroupLevel.ADMIN:
            return 1;
        case GroupLevel.SUPERADMIN:
            return 2;
    }
};

export const getNumberFromAccountType = (level?: AccountType) => {
    switch (level) {
        case AccountType.USER:
            return 0;
        case AccountType.DONOR:
            return 1;
        case AccountType.SPONSOR:
            return 2;
        case AccountType.MODERATOR:
            return 3;
        case AccountType.DEVELOPER:
            return 4;
        case AccountType.ADMIN:
            return 5;
        default:
            return 0;
    }
};
