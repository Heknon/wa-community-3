import {jidDecode, WASocket} from "@adiwajshing/baileys";
import {CommandTrigger, EconomyCommand} from "../..";
import {BlockedReason} from "../../../blockable";
import {commas} from "../../../utils/utils";
import languages from "../../../config/language.json";
import {weightedChoice} from "./utils";
import {pluralForm} from "../../../utils/message_utils";
import {AccountType} from "@prisma/client";
import {Chat, User} from "../../../db/types";
import Message from "../../../messaging/message";
import {getUserRandom} from "../../../user/user";

type PostMemeResponse = {
    title: string;
    footer: string;
    money_range: [number, number];
};

type PostMemeWeightedResponse = [number, PostMemeResponse];

export default class PostMemesCommand extends EconomyCommand {
    private language: typeof languages.commands.postmemes[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.postmemes;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            category: lang.category,
            description: lang.description,
            cooldowns: new Map([
                [AccountType.USER, 45 * 1000],
                [AccountType.DONOR, 20 * 1000],
                [AccountType.SPONSOR, 15 * 1000],
            ]),
        });

        this.language = lang;
        this.langCode = language;
    }

    async execute(
        client: WASocket,
        chat: Chat,
        user: User,
        message: Message,
        body: string,
        trigger: CommandTrigger,
    ) {
        const getCoinText = (number: number) =>
            pluralForm(number, languages.economy.coin[this.langCode]);

        // pick a meme response
        const responses = this.language.execution.responses as PostMemeWeightedResponse[];
        const memesChoosable = this.language.execution.memes;
        const memesText = memesChoosable.map((memeName, i) => `*${i + 1}.* ${memeName}`).join("\n");
        const memesNumbers = memesChoosable
            .map((memeName, i) => [memeName, (i + 1).toString()])
            .flat();
        const meme = weightedChoice(responses.map((e) => [e[1], e[0]]));

        const requestText = `${this.language.execution.request_title}\n\n${this.language.execution.request_body}\n${this.language.execution.request_footer}\n\n${memesText}`;
        await message.replyAdvanced({text: requestText, mentions: [user.jid]}, true, {
            placeholder: this.getDefaultPlaceholder({chat, message, user}),
        });
        const memeChosenMsg = await this.validatedWaitForInteractionWith(
            message,
            (msg) => msg.reply(memesText, true),
            20 * 1000,
            () => message.reply(this.language.execution.too_long, true),
            ...memesNumbers,
        );

        if (!memeChosenMsg) return;

        const num = Number(memeChosenMsg.content?.trim()) - 1;
        const memeChosen =
            !num && num != 0
                ? memesChoosable.findIndex((e) =>
                      memeChosenMsg.content?.trim().toLowerCase().startsWith(e.toLowerCase()),
                  )
                : num;

        if (memeChosen === -1) {
            return await message.reply(this.language.execution.invalid_meme, true);
        }

        const random = getUserRandom(user);
        const memeResponse = memesChoosable[memeChosen];
        const memeResponseText = `${this.language.execution.request_title}\n\n${meme.title}\n${meme.footer}`;
        const coinsAmount = random.intBetween(meme.money_range[0], meme.money_range[1]);

        await message.replyAdvanced({text: memeResponseText, mentions: [user.jid]}, true, {
            placeholder: this.getDefaultPlaceholder({
                chat,
                message,
                user,
                custom: {
                    coin: getCoinText(coinsAmount),
                    coins: commas(coinsAmount),
                },
            }),
        });
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
