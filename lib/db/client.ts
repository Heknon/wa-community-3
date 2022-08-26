// src/server/db/client.ts
import {Prisma, PrismaClient} from "@prisma/client";
import {createPrismaRedisCache} from "prisma-redis-middleware";
import {env} from "process";
import Redis from "ioredis";

// export const redis = new Redis(6379, "localhost", {
//     password: env.REDIS_PASSWORD,
//     db: env.REDIS_DB ? parseInt(env.REDIS_DB) : 0,
// });

export const prisma = new PrismaClient({
    log: ["warn", "error"],
});

// const cacheMiddleware: any = createPrismaRedisCache({
//     storage: {
//         type: "redis",
//         options: {client: redis, invalidation: {referencesTTL: 300}, log: console},
//     },
//     cacheTime: 300,
//     excludeModels: ["Cooldown", "Reminder", "DailyReward"],
//     excludeMethods: ["count", "groupBy"],
// });

// prisma.$use(cacheMiddleware);

if (env.NODE_ENV !== "production") {
    global.prisma = prisma;
}
