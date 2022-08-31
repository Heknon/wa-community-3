// src/server/db/client.ts
import {Prisma, PrismaClient} from "@prisma/client";
import {createPrismaRedisCache} from "prisma-redis-middleware";
import {env} from "process";
import Redis from "ioredis";

export const redis = new Redis(6379, "localhost", {
    password: env.REDIS_PASSWORD,
    db: 2,
});

export const redisCooldown = new Redis(6379, "localhost", {
    password: env.REDIS_PASSWORD,
    db: 3,
    keyPrefix: "cooldown:",
});

export const redisBotAuth = new Redis(6379, "localhost", {
    password: env.REDIS_PASSWORD,
    db: 4,
    keyPrefix: "auth:",
});

export const redisAlerts = new Redis(6379, "localhost", {
    password: env.REDIS_PASSWORD,
    db: 5,
    keyPrefix: "alert:",
});


export const redisUserStats = new Redis(6379, "localhost", {
    password: env.REDIS_PASSWORD,
    db: 15,
});

export const redisChatStats = new Redis(6379, "localhost", {
    password: env.REDIS_PASSWORD,
    db: 14,
});

export const redisCommandStats = new Redis(6379, "localhost", {
    password: env.REDIS_PASSWORD,
    db: 13,
});

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
