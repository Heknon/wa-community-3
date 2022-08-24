import {proto, WASocket} from "@adiwajshing/baileys";
import {Configuration, OpenAIApi} from "openai";
import {BlockedReason} from "../../../blockable";
import Message from "../../../../lib/messaging/message";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";
import languages from "../../../config/language.json";
import {AccountType} from "@prisma/client";
import {Chat, User} from "../../../db/types";

export default class GptCommand extends Command {
    private language: typeof languages.commands.gpt[Language];
    private texts: string[];

    constructor(language: Language) {
        const langs = languages.commands.gpt;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            accountType: "DONOR",
            description: lang.description,
            cooldowns: new Map([
                [AccountType.DONOR, 20 * 1000],
                [AccountType.SPONSOR, 10 * 1000],
            ]),
        });

        this.language = lang;

        this.configuration = new Configuration({
            apiKey: process.env.OPENAI_API_KEY,
        });

        this.openai = new OpenAIApi(this.configuration);

        this.texts = lang.execution.thinking_texts;
    }

    configuration: Configuration;
    openai: OpenAIApi;

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        if (!body) {
            return await message.reply(this.language.execution.no_question, true, {
                placeholder: this.getDefaultPlaceholder({chat, message}),
            });
        }

        // body can only contain english and special characters
        if (!/^[a-zA-Z0-9\s\.,;:!?\(\)\[\]\{\}'"-\*&\$#@%\^\-\+]+$/.test(body)) {
            return await message.reply(this.language.execution.only_english, true);
        }

        message.reply(this.texts[Math.floor(Math.random() * this.texts.length)], true);

        this.openai
            .createCompletion({
                model: "text-davinci-002",
                prompt: body,
                temperature: 0.7,
                max_tokens: 1800,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
            })
            .then((response) => {
                const blank = this.language.execution.too_long;
                const text = response.data.choices ? response.data.choices[0].text ?? blank : blank;
                message.reply(text.trim(), true);
            })
            .catch((err) => {
                message.reply(this.language.execution.too_long, true);
            });
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
