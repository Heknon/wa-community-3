import {jidDecode} from "@adiwajshing/baileys";
import {PhoneNumberUtil} from "google-libphonenumber";
import moment from "moment";
const phoneUtil: PhoneNumberUtil = PhoneNumberUtil.getInstance();

export const hasActiveItemExpired = (activeItem: {expire?: Date | null} | undefined | null) => {
    if (!activeItem) return true;
    if (!activeItem.expire) return false;

    return moment().utc().isAfter(activeItem.expire);
};

console.log(hasActiveItemExpired({expire: new Date('2022-09-04T11:07:13.236Z')}));
