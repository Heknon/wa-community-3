import {isJidGroup, isJidUser, jidDecode} from "@adiwajshing/baileys";
import {prisma} from "../db/client";
import {Chat as FullChat} from "../db/types";
import config from "../config/config.json";
import {whatsappBot} from "..";
import {PhoneNumberUtil} from "google-libphonenumber";
import {Language} from "@prisma/client";
import { logger } from "../logger";
const phoneUtil: PhoneNumberUtil = PhoneNumberUtil.getInstance();

export const createChat = async (jid: string) => {
    return prisma.chat.create({
        data: {
            name: "",
            prefix: config.default_command_prefix,
            type: isJidGroup(jid) ? "GROUP" : isJidUser(jid) ? "DM" : "DM",
            jid: jid,
            language: await getLanguageFromJid(jid).catch((e) => {
                console.log("ERROR CALCULATING LANGUAGE")
                console.error(e);
                return Language.hebrew;
            }),
        },
        include: {
            responses: true,
            chatRank: chatRankInclusion,
        },
    }).catch(e => {
        logger.error("CREATION ERROR")
        console.error(e);
        return null;
    });
};

export const getFullChat = async (jid: string): Promise<FullChat | null> => {
    return prisma.chat
        .findUnique({
            where: {
                jid: jid,
            },
            include: {
                responses: true,
                chatRank: chatRankInclusion,
            },
        })
        .catch((err) => {
        logger.error("FETCHING ERROR")

            console.error(err)
            return null;
        });
};

export const chatRankInclusion = {
    select: {
        id: true,
        gifter: {
            select: {
                jid: true,
                phone: true,
                accountType: true,
            },
        },
    },
};

export const getLanguageFromJid = async (jid: string) => {
    const countryCodes = await getJidCountryCode(jid);
    if (countryCodes.length === 0) {
        return Language.hebrew;
    }

    let majorityAppearencesTrack = new Map<string, number>();
    let majorityCountryCode = countryCodes[0];
    for (const countryCode of countryCodes) {
        if (majorityAppearencesTrack.has(countryCode)) {
            majorityAppearencesTrack.set(
                countryCode,
                majorityAppearencesTrack.get(countryCode)! + 1,
            );
        } else {
            majorityAppearencesTrack.set(countryCode, 1);
        }

        if (
            majorityAppearencesTrack.get(countryCode)! >
            (majorityAppearencesTrack.get(majorityCountryCode) ?? 0)
        ) {
            majorityCountryCode = countryCode;
        }
    }

    if (majorityCountryCode === "972") {
        return Language.hebrew;
    }

    return Language.english;
};

export const getJidCountryCode = async (jid: string): Promise<string[]> => {
    if (isJidUser(jid)) {
        const phone = phoneUtil.parse(jidDecode(jid)?.user);
        return [phone.getCountryCode()?.toString()].filter((c) => c !== undefined) as string[];
    } else if (isJidGroup(jid)) {
        const chat = await whatsappBot.client?.groupMetadata(jid);
        const countryCodes = chat?.participants.map((participant) =>
            phoneUtil.parse(jidDecode(participant.id)?.user)?.getCountryCode()?.toString(),
        );

        return (countryCodes?.filter((countryCode) => countryCode !== undefined) ?? []) as string[];
    } else {
        return [];
    }
};

export const doesChatExist = async (jid: string): Promise<boolean> => {
    return !!(await prisma.chat.findFirst({
        where: {
            jid: jid,
        },
    }));
};
