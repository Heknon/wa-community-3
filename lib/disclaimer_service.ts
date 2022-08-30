import Redis from "ioredis";
import {env} from "process";
import {SAFE_DEBUG_MODE} from ".";
import {prisma} from "./db/client";
import {Chat} from "./db/types";
import {logger} from "./logger";
import {messagingService} from "./messaging";

class DisclaimerService {
    private sendDisclaimerJidsBlock: Set<string> = new Set();

    constructor() {}

    public async sendDisclaimer(chat: Chat, enforceNotSent: boolean = true): Promise<void> {
        const joinMessage = `**Disclaimer**\
                \nThis bot is handled and managed by a human\
                \nAs such, I have the ability to see the messages in this chat.\
                \nI DO NOT plan to but the possibility is there.\
                \nIf you are not keen with this, do not send the bot messages.\
                \nTerms: https://leo-bot.com/terms\
                \nPrivacy: https://leo-bot.com/privacy\
                \nEnjoy my bot! Get started using: ${chat.prefix}help\n\nP.S You can DM the bot.\n\nI must also mention that this is the same with every bot. We are the only one that mention this.\n\n_Heavy inspiration was taken from Dank Memer bot (Discord)_`;

        const joinMessageHebrew = `**התראה**\nהבוט מנוהל על ידי אדם.\
                    \nבכך ברשותי האפשרות לצפות בהודעות בצ'אטים.\
                    \n*אני לא* מתכנן לעשות זאת אך האפשרות קיימת.\
                    \nאם אינך מעוניין בכך, אל תשלח לבוט הודעות.\
                    \nתנאי שימוש: https://leo-bot.com/terms\
                    \nמדיניות פרטיות: https://leo-bot.com/privacy\
                    \nתהנו מהבוט שלי!\
                    \nכתבו ${chat.prefix}עזרה כדי להתחיל להשתמש בו!\n\nיש להבהיר שככה זה עם כל הבוטים בווצאפ. לכולם יש גישה לראות את ההודעות שלכם איתם.\nאנו בין היחידים שמבהירים זאת.`;

        if (
            SAFE_DEBUG_MODE &&
            chat.jid != "120363041344515310@g.us" &&
            chat.jid != "972557223809@s.whatsapp.net"
        )
            return;

        if (enforceNotSent && chat.sentDisclaimer) {
            return;
        }

        if (this.sendDisclaimerJidsBlock.has(chat.jid)) {
            return;
        }
        this.sendDisclaimerJidsBlock.add(chat.jid);

        try {
            await messagingService.sendMessage(chat.jid, {
                text: joinMessage,
                buttons: [{buttonText: {displayText: `${chat.prefix}help`}, buttonId: "0"}],
            });

            await messagingService.sendMessage(chat.jid, {
                text: joinMessageHebrew,
                buttons: [{buttonText: {displayText: `${chat.prefix}עזרה`}, buttonId: "0"}],
            });

            const updatedChat = await prisma.chat.update({
                where: {
                    jid: chat.jid,
                },
                data: {
                    sentDisclaimer: true,
                },
            });
        } catch (err) {
            logger.error(`Error sending disclaimer to ${chat.jid}`);
            logger.error(err);
        }

        this.sendDisclaimerJidsBlock.delete(chat.jid);

        logger.debug(`Sent disclaimer to ${chat.jid}`, {jid: chat.jid});
    }
}

export const disclaimerService = new DisclaimerService();
