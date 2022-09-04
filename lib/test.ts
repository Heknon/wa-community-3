import {jidDecode} from "@adiwajshing/baileys";
import {PhoneNumberUtil} from "google-libphonenumber";
const phoneUtil: PhoneNumberUtil = PhoneNumberUtil.getInstance();

export const getJidLanguage = async (jid: string) => {
    const phone = phoneUtil.parse("+" + jidDecode(jid)?.user);
    return phone;
};

(async () => {
    const res = await getJidLanguage("1585551784@s.whatsapp.net");
    console.log(res.getCountryCode());
})();
