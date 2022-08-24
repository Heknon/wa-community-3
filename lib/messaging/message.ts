import type {AnyMessageContent, MediaType, WAMessage} from "@adiwajshing/baileys/lib/Types/Message";
import {isJidGroup} from "@adiwajshing/baileys/lib/WABinary/jid-utils";
import { messagingService } from ".";
import { User, Chat } from "../db/types";
import { getMediaPath, getMessageMedia, getMessageMediaType, saveMessageMedia } from "../utils/media_utils";
import { getMessageBody, getQuotedMessage } from "../utils/message_utils";
import { BotClient } from "../whatsapp_bot";
import Metadata from "./metadata";
import { Placeholder } from "./types";

export default class Message {
    public _media: Buffer | undefined;

    constructor(
        public raw: WAMessage | undefined,
        public content: string | undefined,
        public from: string,
        public to: string,
        public mediaType: MediaType | undefined,
        public mediaPath: string | undefined,
        public timestamp: number,
        public quoted: Message | undefined,
        public metadata: Metadata | undefined,
    ) {}

    public inGroup() {
        return isJidGroup(this.to);
    }

    /**
     * Will be true if the message is from the bot
     */
    public get fromBot() {
        return this.from == BotClient.currentClientId;
    }

    public get senderJid() {
        if (isJidGroup(this.to)) return this.from;

        if (this.fromBot && this.raw?.key.fromMe) return BotClient.currentClientId;
        return this.fromBot ? this.to : this.from;
    }

    public static async fromWAMessage(
        message: WAMessage,
        metadata: Metadata | undefined = undefined,
    ): Promise<Message> {
        const fromGroup = isJidGroup(message.key.remoteJid!);
        const fromMe = fromGroup
            ? message.key.participant! == BotClient.currentClientId ||
              message.participant! == BotClient.currentClientId ||
              message.key.fromMe
            : message.key.fromMe;
        const from = fromMe
            ? BotClient.currentClientId
            : fromGroup
            ? message.key.participant ?? message.participant
            : message.key.remoteJid!;
        const to = fromGroup ? message.key.remoteJid! : fromMe ? message.key.remoteJid! : BotClient.currentClientId;

        let quoted: WAMessage | undefined = getQuotedMessage(message);
        const mediaBlocked = metadata?.meta.get("media") == false;

        return new Message(
            message,
            getMessageBody(message),
            from!,
            to!,
            getMessageMediaType(message),
            !mediaBlocked ? getMediaPath(message) : undefined,
            Number(message.messageTimestamp!),
            quoted ? await this.fromWAMessage(quoted!, undefined) : undefined,
            metadata,
        );
    }

    public static calculateSaveId(message: WAMessage) {
        return `${message.key.id}-${message.key.remoteJid}-${message.messageTimestamp}-${message.key.participant}`;
    }

    public get media() {
        if (this._media) return this._media;

        return getMessageMedia(this).then(async (f) => {
            if (f) return f;
            if (!this.raw) return;
            await saveMessageMedia(this.raw);
            this._media = await getMessageMedia(this);
            return this._media;
        });
    }

    // no checks to actually get message media from WA. Not recommended.
    public get cachedMedia(): Buffer | undefined {
        return this._media;
    }

    public get mentions() {
        return this.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    }

    public reply(
        content: string,
        quote: boolean = false,
        {
            privateReply = false,
            metadata,
            placeholder,
        }: {
            privateReply?: boolean;
            metadata?: Metadata;
            placeholder?: Placeholder;
        } = {},
    ) {
        return messagingService.reply(this, content, quote, {privateReply, metadata, placeholder});
    }

    public replyAdvanced(
        content: AnyMessageContent,
        quote: boolean = false,
        {
            privateReply = false,
            metadata,
            placeholder,
        }: {
            privateReply?: boolean;
            metadata?: Metadata;
            placeholder?: Placeholder;
        } = {},
    ) {
        return messagingService.replyAdvanced(this, content, quote, {privateReply, metadata, placeholder});
    }
}
