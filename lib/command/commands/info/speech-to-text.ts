import {WASocket} from "@adiwajshing/baileys";
import {BlockedReason} from "../../../blockable";
import Message from "../../../../lib/messaging/message";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";
import {spawn} from "child_process";
import path from "path";
import {TextDecoder} from "util";
import languages from "../../../config/language.json";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import crypto from "crypto";
import {Chat, User} from "../../../db/types";

/**
 * DEVELOPER NOTE:
 * In order for this command to work you must have SpeechRecognition and pydub installed from pip as global packages!
 */
export default class SpeechToTextCommand extends Command {
    private language: typeof languages.commands.speech_to_text[Language];
    private audioSavePath: string = path.resolve(__dirname, "../../../../lib/scripts/inputs/");

    constructor(language: Language) {
        const langs = languages.commands.speech_to_text;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            description: lang.description,
            extendedDescription: lang.extended_description,
        });

        this.language = lang;
    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        const quoted = message.quoted;
        if (!quoted) {
            return await message.reply(this.language.execution.no_reply, true);
        }

        const mediaType = quoted.mediaType;
        if (mediaType !== "audio") {
            return await message.reply(this.language.execution.no_audio, true);
        }

        const audioPath = quoted.mediaPath;
        let media: Buffer | undefined;
        if (audioPath && !fs.existsSync(audioPath)) {
            media = await quoted.media;
        }

        // if media is bigger than 10mb return error
        if (media && media.length > 10 * 1024 * 1024) {
            return await message.reply(this.language.execution.too_big, true);
        }

        if (!audioPath || !fs.existsSync(audioPath) || !media) {
            return await message.reply(this.language.execution.no_audio_in_storage, true);
        }

        const id = `${Date.now().toString()}-${crypto.randomBytes(3).readUintLE(0, 3).toString(36)}`;
        const savePath = `${this.audioSavePath}/${id}.wav`;
        await message.reply(this.language.execution.started, true);

        ffmpeg(audioPath)
            .toFormat("wav")
            .on("error", (err) => message.reply(this.language.execution.error, true))
            .save(savePath)
            .on("end", () => {
                const pythonProcess = spawn("python", [
                    path.resolve(__dirname, "../../../../lib/scripts/speech-to-text.py"),
                    path.resolve(savePath),
                    id,
                    body?.trim()?.split(" ")[0] || "he",
                ]);

                pythonProcess.stdout
                    .on("data", async (data) => {
                        const text = new TextDecoder("utf-8").decode(data);
                        await message.reply(this.language.execution.success_message, true, {
                            placeholder: {
                                custom: new Map([["text", text]]),
                            },
                        });
                    })
                    .on("error", (err) => {
                        message.reply(this.language.execution.error, true);
                    });
            });
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
