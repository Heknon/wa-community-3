// src/server/db/client.ts
import {PrismaClient} from "@prisma/client";
import {env} from "process";

export const prisma = new PrismaClient({
    log: ["query"],
});

if (env.NODE_ENV !== "production") {
    global.prisma = prisma;
}
