import moment from "moment";
import {createLogger, format, transports} from "winston";
import pino from "pino";
import fs from "fs";

const logDirectory = "./logs";
const botLogsDirectory = `${logDirectory}/bot`;
const botStoreDirectory = `${logDirectory}/store`;
const botTrafficDirectory = `${logDirectory}/traffic`;
// ensure log directory exists
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);

fs.existsSync(botStoreDirectory) || fs.mkdirSync(botStoreDirectory);
fs.existsSync(botTrafficDirectory) || fs.mkdirSync(botTrafficDirectory);
fs.existsSync(botLogsDirectory) || fs.mkdirSync(botLogsDirectory);

export const logger = createLogger({
    level: "info",
    exitOnError: false,
    format: format.json(),
    transports: [
        new transports.File({
            filename: `${botLogsDirectory}/${moment().format("DD-MM-YYYY-HH-mm-ss")}.log`,
            level: "info",
            format: format.combine(format.json()),
            maxsize: 1024 * 1024 * 20, // 20MB
        }),
        new transports.Console({
            level: "debug",
            format: format.combine(
                format.splat(),
                format.colorize(),
                format.timestamp({format: "YYYY-MM-DD HH:mm:ss"}),
                format.metadata({fillExcept: ["message", "level", "timestamp", "label"]}),
                format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
            ),
        }),
    ],
});

export const botTrafficLogger = pino(
    {
        level: "silent",
    },
    pino.destination(`${botTrafficDirectory}/${moment().format("DD-MM-YYYY-HH-mm-ss")}.log`),
);

export const storeLogger = pino(
    {
        level: "silent",
        stream: "store",
    },
    pino.destination(`${botStoreDirectory}/${moment().format("DD-MM-YYYY-HH-mm-ss")}.log`),
);
