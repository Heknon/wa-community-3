import {DownloadableMessage, downloadContentFromMessage, proto, MediaType} from "@adiwajshing/baileys";
import fs from "fs";
import axios from "axios";
import crypto from "crypto";
import Message from "../messaging/message";

export async function extractMediaToMediaFolders(message: proto.IWebMessageInfo) {}

export async function urlToBuffer(url: string) {
    const response = await axios.get(url, {responseType: "arraybuffer"});
    return Buffer.from(response.data, "utf-8");
}

export async function getMessageMediaBuffer(message: proto.IWebMessageInfo): Promise<Buffer | undefined> {
    const stream = await extractMessageMediaStream(message);
    if (!stream) return;

    let buffer = Buffer.from([]);

    // convert stream to buffer
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }

    return buffer;
}

export async function saveMessageMedia(message: proto.IWebMessageInfo): Promise<string | undefined> {
    const mediaPath = getMediaPath(message);
    if (!mediaPath) return;

    const mediaBuffer = await getMessageMediaBuffer(message);
    if (!mediaBuffer) return;
    await new Promise((res, rej) => {
        fs.writeFile(mediaPath, mediaBuffer, {}, (err) => {
            err ? rej(err) : res(mediaPath);
        });
    });
    return mediaPath;
}

export function getMediaPath(message: proto.IWebMessageInfo) {
    const mediaFolderPath = "./wa_media";
    const mediaType = getMessageMediaType(message);
    if (!mediaType) return;

    if (!fs.existsSync(mediaFolderPath)) {
        fs.mkdirSync(mediaFolderPath);
    }

    if (!fs.existsSync(`${mediaFolderPath}/` + mediaType)) {
        fs.mkdirSync(`${mediaFolderPath}/` + mediaType);
    }

    const mimetypeData = getMediaMessage(message)?.mimetype;
    if (!mimetypeData) return;

    const mimetype = mimetypeData.split(";")[0].split("/")[1];
    if (!mimetype) return;

    return `${mediaFolderPath}/${mediaType}/${Message.calculateSaveId(message)}.${mimetype}`;
}

export async function getMessageMedia(message: Message) {
    const mediaPath = message.mediaPath;
    if (!mediaPath) return;
    if (!fs.existsSync(mediaPath)) return;
    return new Promise<Buffer>((res, rej) => fs.readFile(mediaPath, (err, data) => (err ? rej(err) : res(data))));
}

export async function getTemporaryFilePath(extension?: string) {
    const tempFolderPath = await getTemporaryDirectoryPath();

    const randomCode = crypto.randomBytes(6).readUintLE(0, 6).toString(36);
    return `${tempFolderPath}/${randomCode}-${Date.now()}${extension ? '.' + extension : ''}`;
}

export async function getTemporaryDirectoryPath() {
    const tempFolderPath = `${__dirname}/temp`;
    if (!fs.existsSync(tempFolderPath)) {
        fs.mkdirSync(tempFolderPath);
    }

    return tempFolderPath;
}

export function getMessageMediaType(message: proto.IWebMessageInfo) {
    if (message.message?.imageMessage) {
        return "image";
    } else if (message.message?.videoMessage) {
        return "video";
    } else if (message.message?.stickerMessage) {
        return "sticker";
    } else if (message.message?.documentMessage) {
        return "document";
    } else if (message.message?.audioMessage) {
        return "audio";
    }
}

export function getMediaMessage(message: proto.IWebMessageInfo) {
    const type = getMessageMediaType(message);

    switch (type) {
        case "image":
            return message.message?.imageMessage;
        case "video":
            return message.message?.videoMessage;
        case "sticker":
            return message.message?.stickerMessage;
        case "document":
            return message.message?.documentMessage;
        case "audio":
            return message.message?.audioMessage;
        default:
            return;
    }
}

export async function extractMessageMediaStream(message: proto.IWebMessageInfo) {
    const mediaMessage = getMediaMessage(message);
    if (!mediaMessage) return;

    const mediaType = getMessageMediaType(message);
    if (!mediaType) return;

    return downloadContentFromMessage(mediaMessage as DownloadableMessage, mediaType);
}
