import {jidDecode} from "@adiwajshing/baileys";
import {prisma} from "../db/client";
import {User as FullUser} from "../db/types";
import config from "../config/config.json";

export const getFullUser = async (jid: string): Promise<FullUser | null> => {
    return await prisma.user.findUnique({
        where: {jid},
        include: {
            daily: true,
            items: true,
            money: true,
            reputation: true,
            activeItems: true,
            giftedRanks: true,
        },
    });
};

export const createUser = async (jid: string, name: string): Promise<FullUser> => {
    return prisma.user.create({
        data: {
            jid,
            name,
            phone: jidDecode(jid)?.user ?? "",
            money: {
                connectOrCreate: {
                    where: {userJid: jid},
                    create: {
                        bank: 0,
                        wallet: 0,
                        bankCapacity: config.bank_start_capacity,
                    },
                },
            },
            accountType: "USER",
            daily: {
                connectOrCreate: {
                    where: {userJid: jid},
                    create: {
                        lastDaily: new Date(0),
                        streak: 0,
                    },
                },
            },
            reputation: {
                connectOrCreate: {
                    where: {userJid: jid},
                    create: {
                        reputation: 0,
                        reputationGiven: [],
                    },
                },
            },
        },
        include: {
            money: true,
            daily: true,
            items: true,
            reputation: true,
            activeItems: true,
            giftedRanks: true,
        },
    });
};
