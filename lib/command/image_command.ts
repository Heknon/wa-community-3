import {AnyMessageContent, jidDecode, WASocket} from "@adiwajshing/baileys";
import axios from "axios";
import CommandTrigger from "./command_trigger";
import InteractableCommand from "./interactable_command";
import {BlockedReason} from "../blockable";
import {writeFileSync} from "fs";
import Ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import {getTemporaryFilePath} from "../utils/media_utils";
import {removeNumbersFromString, rescueNumbers} from "../utils/regex_utils";
import {Chat, User} from "../db/types";
import languages from "../config/language.json";
import {AccountType} from "@prisma/client";
import Message from "../messaging/message";
import {BotClient} from "../whatsapp_bot";
import {prisma} from "../db/client";
import {logger} from "../logger";

type ImageCommandRequestBody = {
    text: string;
    avatars: string[];
    usernames: string[];
    kwargs?: {[key: string]: any};
    img: string | undefined;
};

export type ImageGenCommandData = {
    route: string;
    name: {
        english: string;
        hebrew: string;
    };
    type: "post" | "get";
    required: {
        mentions: 0 | 1 | 2;
        text: boolean;
    };
};

export default class ImageCommand extends InteractableCommand {
    private lang: typeof languages.commands.image[Language];
    private route: string;

    constructor(
        private genData: ImageGenCommandData,
        private language: Language,
        {category, description}: {category?: string; description?: string},
    ) {
        super({
            triggers: Object.values(genData.name)
                .filter((e) => e)
                .map((e) => new CommandTrigger(e)),
            announcedAliases: [
                genData.name[language] ? genData.name[language] : genData.name["english"],
            ],
            usage:
                "{prefix}{command}" +
                (genData.required.text ? " <text>" : "") +
                (genData.required.mentions
                    ? ` ${Array(genData.required.mentions)
                          .map((e, i) => `@user${i}`)
                          .join(" ")}`
                    : ""),
            category: category,
            description: description,
            cooldowns: new Map([
                [AccountType.USER, 15 * 1000],
                [AccountType.DONOR, 7 * 1000],
                [AccountType.SPONSOR, 4 * 1000],
            ]),
        });

        this.route = `http://localhost:8080/api/${genData.route}`;
        this.lang = languages.commands.image[language];
    }

    async execute(
        client: WASocket,
        chat: Chat,
        user: User,
        message: Message,
        body: string,
        trigger: CommandTrigger,
    ) {
        const requestBody: ImageCommandRequestBody = {
            text: body,
            avatars: [],
            usernames: [],
            kwargs: {},
            img: undefined,
        };

        let msgMentions = message.mentions;

        msgMentions.forEach((mention) => {
            body = body.replace(`@${jidDecode(mention)?.user}`, "");
        });

        if (msgMentions.length < this.genData.required.mentions) {
            const numbersInText = rescueNumbers(body)
                .slice(0, 5)
                .map((e) => e + "@s.whatsapp.net");
            const onWhatsApp = (
                await Promise.all(numbersInText.map((e) => client.onWhatsApp(e)))
            ).flat();
            const [jid1, jid2] = onWhatsApp
                .filter((e) => e.exists)
                .slice(0, 2)
                .map((e) => e.jid);

            if (jid1) msgMentions.push(jid1);
            if (jid2) msgMentions.push(jid2);
            msgMentions.slice(0, 2);

            body = removeNumbersFromString(
                body,
                undefined,
                jid1?.replace("@s.whatsapp.net", ""),
                jid2?.replace("@s.whatsapp.net", ""),
            ).trim();
        }

        if (msgMentions.length == 0) {
            if (this.genData.required.mentions == 2) {
                msgMentions.push(BotClient.currentClientId!);
                msgMentions.push(message.senderJid!);
            } else if (this.genData.required.mentions <= 1) {
                msgMentions.push(message.senderJid!);
                msgMentions.push(BotClient.currentClientId!);
            }
        }

        if (msgMentions.length == 1) {
            if (this.genData.required.mentions == 2) {
                msgMentions = [message.senderJid!, msgMentions[0] ?? BotClient.currentClientId!];
            } else if (this.genData.required.mentions <= 1) {
                msgMentions.push(msgMentions[0] ?? BotClient.currentClientId);
            }
        }

        msgMentions.slice(0, 2);
        const mentions: string[] = [msgMentions[0], msgMentions[1]];
        const users = await Promise.all(
            mentions.map((e) => (e ? prisma.user.findUnique({where: {jid: e}}) : undefined)),
        );
        const avatarUrls = await Promise.all(
            mentions.map((e) =>
                e ? client.profilePictureUrl(e).catch((err) => "bsurl") : undefined,
            ),
        );

        let imgProvided = (await message.media) ?? (await message.quoted?.media);
        if (imgProvided && imgProvided.length > 3 * 1024 * 1024) imgProvided = undefined;
        else requestBody.img = imgProvided?.toString("base64");

        if (this.genData.required.mentions === 2) {
            requestBody.avatars = [avatarUrls[0]!, avatarUrls[1]!];
        } else if (this.genData.required.mentions === 1) {
            requestBody.avatars = [avatarUrls[0] ?? avatarUrls[1]!];
        }

        requestBody.usernames = users
            .map((e) =>
                e ? e.name || this.lang.execution.default_name : this.lang.execution.default_name,
            )
            .filter((e) => e !== undefined) as string[];

        if (this.genData.required.text) {
            if (!body || body.length === 0) {
                return message.reply(this.lang.execution.body_required, true);
            }

            requestBody.text = body;
        }

        logger.debug(requestBody);
        if (this.genData.type == "post") {
            const response = await axios
                .post(this.route, requestBody, {responseType: "arraybuffer"})
                .catch((err) => {
                    logger.error(err.stack);
                    logger.error(requestBody);
                    const data = JSON.parse(
                        (err.response?.data as Buffer | undefined)?.toString("utf-8") ?? "{}",
                    );
                    if (data && data.status == 400) {
                        message.reply(this.lang.execution.error_map[data.error], true);
                        return;
                    }
                    message.reply(this.lang.execution.error, true);
                    return;
                });

            if (!response) return;

            const data = response.data;
            if (data.error) {
                return message.reply(
                    "An error occurred, if this error persists please contact the developer.",
                    true,
                );
            }

            // check if image response
            const mimetype = response.headers["content-type"];
            const isImage = mimetype.startsWith("image");
            const isGif = mimetype.startsWith("image/gif");
            const content = Buffer.from(data, "binary");

            if (isGif) {
                return this.sendGif(content, message);
            }

            const responseContent = {
                mimetype: mimetype,
                [isImage ? "image" : "video"]: content,
                gifPlayback: isGif,
            };
            return message.replyAdvanced(responseContent as any as AnyMessageContent, true);
        } else if (this.genData.type == "get") {
            const response = await axios
                .get(this.route, {
                    params: {
                        text: requestBody.text,
                        username1: requestBody.usernames[0],
                        username2: requestBody.usernames[1],
                    },
                    responseType: "arraybuffer",
                })
                .catch((err) => {
                    logger.error(err.stack);
                    logger.error(requestBody);
                    const data = JSON.parse(
                        (err.response?.data as Buffer | undefined)?.toString("utf-8") ?? "{}",
                    );
                    if (data && data.status == 400) {
                        message.reply(this.lang.execution.error_map[data.error], true);
                        return;
                    }
                    message.reply(this.lang.execution.error, true);
                    return;
                });

            if (!response) {
                return;
            }

            const data = response.data;
            if (data.error) {
                return message.reply(
                    "An error occurred, if this error persists please contact the developer.",
                    true,
                );
            }

            // check if image response
            const mimetype = response.headers["content-type"];
            const isImage = mimetype.startsWith("image");
            const isGif = mimetype.startsWith("image/gif");
            const content = Buffer.from(data, "binary");

            if (isGif) {
                return this.sendGif(content, message);
            }

            const responseContent = {
                mimetype,
                [isImage ? "image" : "video"]: content,
                gifPlayback: isGif,
            };
            return message.replyAdvanced(responseContent as any as AnyMessageContent, true);
        }
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}

    private async sendGif(buffer: Buffer, message: Message) {
        const tempFilePath = await getTemporaryFilePath();
        writeFileSync(tempFilePath + ".gif", buffer);

        Ffmpeg(tempFilePath + ".gif")
            .format("mp4")
            .addOptions("-movflags", "faststart", "-pix_fmt", "yuv420p")
            .save(tempFilePath + ".mp4")
            .on("end", async () => {
                fs.unlink(tempFilePath + ".gif", () => {});
                return message
                    .replyAdvanced(
                        {
                            mimetype: "video/mp4",
                            video: fs.readFileSync(tempFilePath + ".mp4"),
                            gifPlayback: true,
                        },
                        true,
                    )
                    .then(() => {
                        fs.unlink(tempFilePath + ".mp4", () => {});
                    });
            });
    }
}
