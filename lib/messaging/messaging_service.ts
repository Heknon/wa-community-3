import {
    AnyMessageContent,
    GroupMetadata,
    isJidGroup,
    isJidUser,
    MiscMessageGenerationOptions,
    proto,
    WAMessage,
    WASocket,
} from "@adiwajshing/baileys";
import Message from "./message";
import Metadata from "./metadata";
import {whatsappBot} from "..";
import {applyPlaceholders} from "../utils/message_utils";
import {logger} from "../logger";
import { ObjectId } from "mongodb";
import { Placeholder } from "./types";

export default class MessagingService {
    private client: WASocket | undefined;
    private metadataEnabled: boolean;
    private metadataAssignment: Map<string, Metadata>;
    private messageCallbacks: [
        callbackId: string,
        filter: (message: Message) => Promise<boolean> | boolean,
        callback: (message: Message) => Promise<any> | any,
    ][];

    private sentMessagesCache: Map<string, proto.IMessage> = new Map();

    private _shouldIgnore: boolean = false;

    constructor(client?: WASocket, metadataEnabled: boolean = true) {
        this.client = client;
        this.metadataAssignment = new Map();
        this.messageCallbacks = [];
        this.metadataEnabled = metadataEnabled;

        setInterval(() => {
            // clear references in sentMessagesCache
            this.sentMessagesCache.clear();
        }, 1000 * 60 * 2);
    }

    /**
     * must be ran in order to have messaging services enabled
     * @param message raw message from socket
     * @returns message model with metadata
     */
    public async messageInterceptor(message: WAMessage): Promise<Message> {
        let metadata: Metadata | undefined;
        if (this.metadataEnabled) {
            metadata = this.metadataAssignment.get(message.key.id!);
            this.metadataAssignment.delete(message.key.id!);
        }

        const msg = await Message.fromWAMessage(message, metadata);
        for (const callbackData of this.messageCallbacks) {
            const [callbackId, filter, callback] = callbackData;
            if (await filter(msg)) {
                await callback(msg);
                this.removeMessageCallback(callbackId);
            }
        }

        if (!msg.fromBot && message.key && message.key.remoteJid && message.key.id && message.message) {
            this.storeMessageToCache(message.key.remoteJid, message.key.id, message.message);
        }

        return msg;
    }

    public async reply(
        message: Message,
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
        return await this.replyAdvanced(message, {text: content}, quote, {privateReply, metadata, placeholder});
    }

    public async replyAdvanced(
        message: Message,
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
        if (quote) {
            message.raw!.key.fromMe = false;
        }

        let recipient: string;
        if (isJidGroup(message.to)) {
            recipient = privateReply ? message.from : message.to;
        } else {
            recipient = message.fromBot ? message.to : message.from;
        }

        return this._internalSendMessage(
            recipient,
            content,
            {quoted: quote ? message.raw ?? undefined : undefined},
            metadata,
            placeholder,
        );
    }

    public async sendMessage(
        recipient: string,
        content: AnyMessageContent,
        options?: MiscMessageGenerationOptions,
        {
            metadata,
            placeholder,
        }: {
            metadata?: Metadata;
            placeholder?: Placeholder;
        } = {},
    ) {
        return this._internalSendMessage(recipient, content, options, metadata, placeholder);
    }

    private async _internalSendMessage(
        recipient: string,
        content: AnyMessageContent,
        options?: MiscMessageGenerationOptions,
        metadata?: Metadata,
        placeholder?: Placeholder,
    ): Promise<Message | undefined> {
        if (!this.client || !recipient || !content) return;

        let sentMessage: proto.IWebMessageInfo | undefined;

        try {
            if (metadata) {
                metadata.meta.set("ignore", this._shouldIgnore);
            } else {
                metadata = new Metadata(new Map<string, any>([["ignore", this._shouldIgnore]]));
            }

            if (options?.quoted) {
                options.quoted.key.fromMe = false;
            }

            const text = (content as any).text;
            const caption = (content as any).caption;
            if (text != undefined && text.length > 0)
                (content as any).text = await applyPlaceholders(text, placeholder);
            if (caption != undefined && caption.length > 0)
                (content as any).caption = await applyPlaceholders(caption, placeholder);

            if (isJidUser(recipient) && !(await this.client?.onWhatsApp(recipient))?.[0].exists) {
                return;
            } else if (isJidGroup(recipient)) {
                let groupMeta: GroupMetadata | undefined;
                try {
                    groupMeta = whatsappBot.store.groupMetadata[recipient];
                    if (groupMeta === undefined) {
                        groupMeta = await this.client!.groupMetadata(recipient);
                        if (!groupMeta) return;
                    }
                } catch (e) {
                    return;
                }
            }

            sentMessage = await this.client!.sendMessage(recipient, content, options);
            console.log('sent message')

            if (this.metadataEnabled && metadata) {
                this.metadataAssignment.set(sentMessage?.key.id!, metadata);
            }

            return Message.fromWAMessage(sentMessage!, metadata);
        } catch (error) {
            logger.error("FAILED TO SEND MESSAGE", content, options, error);
            logger.error(error);
            if ((error as any).stack) logger.error((error as any).stack);
            sentMessage = await this.client!.sendMessage(recipient, {text: "Failed to send this message."}, options);
            console.log('sent message')
            return Message.fromWAMessage(sentMessage!, metadata);
        } finally {
            if (sentMessage && sentMessage.message) {
                this.storeMessageToCache(sentMessage.key.remoteJid!, sentMessage.key.id!, sentMessage.message!);
            }
        }
    }

    private storeMessageToCache(jid: string, id: string, message: proto.IMessage) {
        this.sentMessagesCache.set(this.getMessageCacheKey(jid, id), message);
    }

    public getSentMessage(jid: string | undefined, id: string): proto.IMessage | undefined {
        return this.sentMessagesCache.get(this.getMessageCacheKey(jid, id));
    }

    private getMessageCacheKey(jid: string | undefined, id: string): string {
        return `${jid ? `${jid}-` : ""}${id}`;
    }

    public addMessageCallback(
        filter: (message: Message) => boolean | Promise<boolean>,
        callback: (message: Message) => Promise<any> | any,
    ) {
        const id = new ObjectId().toString();
        this.messageCallbacks.push([id, filter, callback]);
        return id;
    }

    public removeMessageCallback(id: string) {
        this.messageCallbacks = this.messageCallbacks.filter((e) => e[0] != id);
    }

    public setClient(client: WASocket) {
        this.client = client;
    }

    public setIgnoreMode(flag: boolean) {
        this._shouldIgnore = flag;
    }
}
