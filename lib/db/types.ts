import {Prisma} from "@prisma/client";

export const GroupLevel: {
    USER: "USER";
    ADMIN: "ADMIN";
    SUPERADMIN: "SUPERADMIN";
} = {
    USER: "USER",
    ADMIN: "ADMIN",
    SUPERADMIN: "SUPERADMIN",
};

export type User = Prisma.UserGetPayload<{
    include: {
        daily: true;
        items: true;
        money: true;
        reputation: true;
        activeItems: true;
    };
}>;

export type Chat = Prisma.ChatGetPayload<{
    include: {
        responses: true;
    };
}>;
