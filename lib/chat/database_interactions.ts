import {isJidGroup, isJidUser} from "@adiwajshing/baileys";
import {prisma} from "../db/client";
import {Chat as FullChat} from "../db/types";
import config from "../config/config.json";


export const createChat = async (jid: string, subject?: string) => {
    return prisma.chat.create({
        data: {
            name: subject ?? jid,
            prefix: config.default_command_prefix,
            type: isJidGroup(jid) ? "GROUP" : isJidUser(jid) ? "DM" : "DM",
            jid: jid,
        },
        include: {
            responses: true,
            chatRank: chatRankInclusion,
        },
    });
};

export const getFullChat = async (jid: string): Promise<FullChat | null> => {
    return prisma.chat.findUnique({
        where: {
            jid: jid,
        },
        include: {
            responses: true,
            chatRank: chatRankInclusion,
        },
    }).catch(err => null);
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
}

export const doesChatExist = async (jid: string): Promise<boolean> => {
    return !!(await prisma.chat.findFirst({
        where: {
            jid: jid,
        },
    }));
};
