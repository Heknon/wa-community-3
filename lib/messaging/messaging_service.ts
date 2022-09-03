import {
    AnyMessageContent,
    isJidGroup,
    MiscMessageGenerationOptions,
    proto,
    WAMessage,
    WASocket,
} from "@adiwajshing/baileys";
import Message from "./message";
import Metadata from "./metadata";
import {applyPlaceholders} from "../utils/message_utils";
import {logger} from "../logger";
import {Placeholder} from "./types";
import cuid from "cuid";
import Queue from "queue";

export default class MessagingService {
    private client: WASocket | undefined;
    private jobQueue: Queue = new Queue({
        concurrency: 2,
        autostart: true,
        results: [],
        timeout: undefined,
    });

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

        this.jobQueue.on('success', (result, job) => {
            if (result && result instanceof Message && result.raw) {
                this.storeMessageToCache(
                    result.raw.key.remoteJid!,
                    result.raw.key.id!,
                    result.raw.message!,
                );
            }
        })

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

        if (
            !msg.fromBot &&
            message.key &&
            message.key.remoteJid &&
            message.key.id &&
            message.message
        ) {
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
            tags,
            buttons,
        }: {
            privateReply?: boolean;
            metadata?: Metadata;
            placeholder?: Placeholder;
            tags?: string[];
            buttons?: string[];
        } = {},
    ) {
        return await this.replyAdvanced(message, {text: content}, quote, {
            privateReply,
            metadata,
            placeholder,
            tags,
            buttons,
        });
    }

    public async replyAdvanced(
        message: Message,
        content: AnyMessageContent,
        quote: boolean = false,
        {
            privateReply = false,
            metadata,
            placeholder,
            tags,
            buttons,
        }: {
            privateReply?: boolean;
            metadata?: Metadata;
            placeholder?: Placeholder;
            tags?: string[];
            buttons?: string[];
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
            tags,
            buttons,
        );
    }

    public async sendMessage(
        recipient: string,
        content: AnyMessageContent,
        options?: MiscMessageGenerationOptions,
        {
            metadata,
            placeholder,
            tags,
            buttons,
        }: {
            metadata?: Metadata;
            placeholder?: Placeholder;
            tags?: string[];
            buttons?: string[];
        } = {},
    ) {
        return this._internalSendMessage(
            recipient,
            content,
            options,
            metadata,
            placeholder,
            tags,
            buttons,
        );
    }

    private async _internalSendMessage(
        recipient: string,
        content: AnyMessageContent,
        options?: MiscMessageGenerationOptions,
        metadata?: Metadata,
        placeholder?: Placeholder,
        tags?: string[],
        buttons?: string[],
    ): Promise<Message | undefined> {
        if (!this.client || !recipient || !content) return;

        if (metadata) {
            metadata.meta.set("ignore", this._shouldIgnore);
        } else {
            metadata = new Metadata(new Map<string, any>([["ignore", this._shouldIgnore]]));
        }

        if (options?.quoted) {
            options.quoted.key.fromMe = false;
        }

        if (tags && tags.length > 0 && !(content as any).mentions) (content as any).mentions = [];
        if (tags && tags.length > 0) {
            ((content as any).mentions as string[]).push(...tags);
        }

        if (buttons && buttons.length > 0 && !(content as any).buttons)
            (content as any).buttons = [];
        if (buttons && buttons.length > 0) {
            ((content as any).buttons as string[]).push(...buttons);
        }

        const text = (content as any).text;
        const caption = (content as any).caption;
        const btns = (content as any).buttons;
        if (text != undefined && text.length > 0)
            (content as any).text = await applyPlaceholders(text, placeholder);
        if (caption != undefined && caption.length > 0)
            (content as any).caption = await applyPlaceholders(caption, placeholder);
        if (btns != undefined && btns.length > 0) {
            if (btns && btns.length > 0) {
                for (const button of btns) {
                    if (!button.buttonText.displayText) continue;
                    button.buttonText.displayText = await applyPlaceholders(
                        button.buttonText.displayText,
                        placeholder,
                    );
                }
            }
        }

        this._sendMessage(recipient, content, options, metadata);
    }

    private _sendMessage(
        recipient: string,
        content: AnyMessageContent,
        options?: MiscMessageGenerationOptions,
        metadata?: Metadata,
    ) {
        if (!this.client || !recipient || !content) return;

        this.jobQueue.push(async (cb) => {
            let msg: WAMessage | undefined;
            try {
                msg = await this.client?.sendMessage(recipient, content, options);
            } catch (err) {
                logger.error(`FAILED TO SEND MESSAGE | ${JSON.stringify(content, null, 2)}`);
                logger.error(err);
                if ((err as any).stack) logger.error((err as any).stack);

                msg = await this.client?.sendMessage(
                    recipient,
                    {text: "Failed to send this message."},
                    options,
                );
            }

            if (msg && msg.message) {
                if (this.metadataEnabled && metadata) {
                    this.metadataAssignment.set(msg?.key.id!, metadata);
                }

                return Message.fromWAMessage(msg, metadata);
            }

            return undefined;
        });
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
        const id = cuid();
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
