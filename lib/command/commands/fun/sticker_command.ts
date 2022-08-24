import {jidDecode, WASocket} from "@adiwajshing/baileys";
import Sticker, {StickerTypes} from "wa-sticker-formatter/dist";
import {BlockedReason} from "../../../blockable";
import Message from "../../../../lib/messaging/message";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";
import languages from "../../../config/language.json";
import {createCanvas} from "canvas";
import {choice} from "../economy/utils";
import moment from "moment";
import {generate} from "text-to-image";
import {Chat, User} from "../../../db/types";
import {prisma} from "../../../db/client";
import Metadata from "../../../messaging/metadata";

export default class StickerCommand extends Command {
    private language: typeof languages.commands.sticker[Language];

    constructor(language: Language) {
        const langs = languages.commands.sticker;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            description: lang.description,
        });

        this.language = lang;
    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        const ogMedia = await message.media;
        const quoted = ogMedia ? undefined : message.quoted;
        const quotedMedia = ogMedia ? undefined : await quoted?.media;
        let messageMedia = ogMedia ?? quotedMedia;

        // 2mb in bytes
        if (messageMedia && messageMedia.length > 3 * 1024 * 1024) {
            return await message.reply(this.language.execution.too_big, true);
        }

        if (!messageMedia && quoted) {
            // draw an image that looks like a whatsapp message
            const font = "Segoe UI";
            const getFontText = (size: number) => `${size}px ${font}`;
            const maxWidth = 350;
            let isEnglish = /[a-zA-Z0-9\s\.,;:!?\(\)\[\]\{\}'"-<>״]+/.test(quoted.content![0]);

            const bgColor = "#212c33";
            const textColor = "#e9edef";
            const footerColor = "#9fa4a7";
            const pushNameColor = "#5d666c";
            const numberColor = choice(["#df64b6", "#f79877", "#d885ea", "#a281f0", "#63baea", "#f7d37c"]);

            const titleFont = getFontText(12.8);
            const bodyFont = getFontText(14.2);
            const footerFont = getFontText(11);

            const userSender = await prisma.user.findUnique({where: {jid: quoted.senderJid}});
            const bodyAuthor = formatJidToCleanNumber(quoted.senderJid) ?? "";
            let pushName = quoted.raw?.pushName || userSender?.name || undefined;
            const timeText = moment.unix(quoted.timestamp!).format("HH:mm");
            if (pushName) pushName = "~" + pushName;
            let bodyText = quoted.content;
            if (!bodyText) return;

            const authorTextSize = getTextSize(bodyAuthor, titleFont);
            const pushNameTextSize = getTextSize(pushName, titleFont);
            const bodyTextLines = getTextLines(bodyText, bodyFont, maxWidth);
            bodyText = bodyTextLines.join("\n").trim();
            const bodyTextSize = getTextSize(bodyText, bodyFont);
            const footerTextSize = getTextSize(timeText, footerFont);

            const messageSize = [
                Math.max(
                    72,
                    Math.max(
                        bodyTextSize.width + 16,
                        authorTextSize.width + pushNameTextSize.width + (pushNameTextSize.width ? 30 : 0) + 16,
                    ),
                ),
                Math.max(
                    72,
                    bodyTextSize.height.ascent +
                        bodyTextSize.height.descent +
                        authorTextSize.height.ascent +
                        authorTextSize.height.descent +
                        pushNameTextSize.height.ascent +
                        pushNameTextSize.height.descent +
                        footerTextSize.height.ascent +
                        footerTextSize.height.descent +
                        10,
                ),
            ];

            const canvas = createCanvas(messageSize[0], messageSize[1]);
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, messageSize[0], messageSize[1]);
            ctx.fillStyle = numberColor;
            ctx.font = "12.8px Segoe UI";
            ctx.fillText(bodyAuthor ?? "", 7, 7 + 12.8);
            if (pushName) {
                ctx.fillStyle = pushNameColor;
                ctx.fillText(pushName, messageSize[0] - 7 - pushNameTextSize.width, 7 + 12.8);
            }

            let numberSize = ctx.measureText(bodyAuthor ?? "");
            ctx.font = "14.2px Segoe UI";
            ctx.fillStyle = textColor;
            ctx.fillText(
                bodyText ?? "",
                isEnglish ? 6 : messageSize[0] - 6 - bodyTextSize.width,
                7 + 14.2 + numberSize["emHeightAscent"] + numberSize["emHeightDescent"],
            );
            ctx.fillStyle = footerColor;
            ctx.font = "11px Segoe UI";
            ctx.fillText(timeText, messageSize[0] - 6 - footerTextSize.width, messageSize[1] - 4);

            messageMedia = canvas.toBuffer();
            return this.sendSticker(message, messageMedia, 100);
        } else if (!messageMedia && body) {
            return generate(body, {
                fontFamily: "Segoe UI",
                fontSize: 42,
                fontWeight: "bold",
                textColor: "#000000",
                bgColor: "#ffffff",
                maxWidth: 512,
                customHeight: 512,
                verticalAlign: "center",
                textAlign: "center",
                lineHeight: 60,
            }).then(async (dataUri) => {
                const buffer = dataUriToBuffer(dataUri);
                return this.sendSticker(message, buffer, 100);
            });
        }

        if (!messageMedia) {
            return await message.reply(this.language.execution.no_media, true);
        }

        this.sendSticker(message, messageMedia, 40);
    }

    private async sendSticker(message: Message, media: Buffer, quality: number) {
        try {
            const stickerBuffer = await this.createSticker(media, "bot", "bot", quality).toBuffer();
            if (stickerBuffer.length < 50) {
                return await message.reply(this.language.execution.no_media, true);
            } else if (stickerBuffer.length > 2 * 1024 * 1024) {
                // if bigger than 2mb error.
                return await message.reply(this.language.execution.too_big, true);
            }

            await message.replyAdvanced({sticker: stickerBuffer}, true, {
                metadata: new Metadata(new Map([["media", false]])),
            });
        } catch (err) {
            return await message.reply(this.language.execution.too_big, true);
        }
    }

    private createSticker(buffer: Buffer, author: string = "bot", pack: string = "bot", quality: number) {
        return new Sticker(buffer, {
            pack: pack,
            author: author,
            type: StickerTypes.FULL,
            quality: quality,
        });
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}

function dataUriToBuffer(string: string) {
    const regex = /^data:.+\/(.+);base64,(.*)$/;

    const matches = string.match(regex);
    const data = matches?.[2];
    return Buffer.from(data ?? "", "base64");
}

function getTextSize(text: string | undefined, font: string) {
    if (text === undefined) return {width: 0, height: {ascent: 0, descent: 0}};

    const canvas = createCanvas(1, 1);
    const ctx = canvas.getContext("2d");
    ctx.font = font;
    const size = ctx.measureText(text);
    return {width: size.width, height: {ascent: size["emHeightAscent"], descent: size["emHeightDescent"]}};
}

function formatJidToCleanNumber(jid?: string) {
    const num = jidDecode(jid)?.user;
    if (!num) return;

    const match = num.match(/^(\d{3})(\d{2})(\d{3})(\d{4})$/);
    if (match) {
        return `+${match[1]} ${match[2]}-${match[3]}-${match[4]}`;
    }
}

function getTextLines(bodyText: string, bodyFont: string, maxWidth: number) {
    const lines: string[] = [];
    let currentLine = "";
    const words = bodyText.split("");
    for (const word of words) {
        const wordSize = getTextSize(word, bodyFont);
        if (wordSize.width + getTextSize(currentLine, bodyFont).width > maxWidth) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine += `${word}`;
        }
    }

    lines.push(currentLine);
    return lines;
}
