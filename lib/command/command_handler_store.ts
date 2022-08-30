import {Language} from "@prisma/client";
import CommandHandler from "../handlers/command_handler";
import imageGenJson from "../config/image_gen.json";
import languagesConf from "../config/language.json";
import {
    JIDCommand,
    PromoteCommand,
    RawCommand,
    ShutdownCommand,
    ExecCommand,
    GiveDonorCommand,
    FullStatsCommand,
    AnonymousCommand,
    LmgtfyCommand,
    MP3Command,
    SpoofCommand,
    StickerCommand,
    ReminderCommand,
    ReputationCommand,
    ClownCommand,
    CommunityCommand,
    JoinCommand,
    AddCommand,
    DeleteCommand,
    GtfoCommand,
    KickCommand,
    EveryoneCommand,
    PrefixCommand,
    DonateCommand,
    CreatorCommand,
    GptCommand,
    HelpCommand,
    VCardCommand,
    PingCommand,
    CodeCommand,
    SpeechToTextCommand,
    LanguageCommand,
} from "./commands";
import {
    BalanceCommand,
    GiveBalanceCommand,
    DailyCommand,
    HighlowCommand,
    DepositCommand,
    BegCommand,
    WithdrawCommand,
    CrimeCommand,
    PostMemesCommand,
    ShopCommand,
    GiveItemCommand,
    UseItemCommand,
    InventoryCommand,
    BuyCommand,
    HuntCommand,
    SellCommand,
} from "./commands/economy";
import ResponseCommand from "./commands/fun/response";
import ImageCommand, {ImageGenCommandData} from "./image_command";

export default class CommandHandlerStore {
    public handlers: Map<Language, CommandHandler> = new Map();
    private static _instance = new CommandHandlerStore();
    public static get instance(): CommandHandlerStore {
        if (!CommandHandlerStore._instance) {
            CommandHandlerStore._instance = new CommandHandlerStore();
        }

        return this._instance;
    }

    constructor() {
        if (CommandHandlerStore._instance) {
            throw new Error("Use CommandHandlerStore.instance instead of new.");
        }

        const languages = Object.keys(Language) as (keyof typeof Language)[];
        languages.forEach((language) => {
            this.handlers.set(language, new CommandHandler());
        });

        const genericCommands = [
            JIDCommand,
            PromoteCommand,
            RawCommand,
            ShutdownCommand,
            ExecCommand,
            GiveDonorCommand,
            FullStatsCommand,
            LanguageCommand,
            GiveBalanceCommand,
        ];

        const languageSpecificCommands = [
            // fun
            AnonymousCommand,
            ResponseCommand,
            LmgtfyCommand,
            MP3Command,
            SpoofCommand,
            StickerCommand,
            ReminderCommand,
            ReputationCommand,
            ClownCommand,
            // community reach
            CommunityCommand,
            JoinCommand,
            // group utils
            AddCommand,
            DeleteCommand,
            GtfoCommand,
            KickCommand,
            EveryoneCommand,
            PrefixCommand,
            // misc
            DonateCommand,
            CreatorCommand,
            GptCommand,
            VCardCommand,
            PingCommand,
            CodeCommand,
            SpeechToTextCommand,
            // economy
            BalanceCommand,
            DailyCommand,
            HighlowCommand,
            DepositCommand,
            BegCommand,
            WithdrawCommand,
            CrimeCommand,
            PostMemesCommand,
            // inventory - items
            InventoryCommand,
            UseItemCommand,
            GiveItemCommand,
            ShopCommand,
            BuyCommand,
            HuntCommand,
            SellCommand
        ];

        genericCommands.forEach((Command) => {
            for (const handler of this.handlers.values()) {
                handler.add(new Command());
            }
        });

        languageSpecificCommands.forEach((Command) => {
            for (const [lang, handler] of this.handlers.entries()) {
                // TODO: lol does this work?
                handler.add(new Command(lang));
            }
        });

        for (const [lang, handler] of this.handlers.entries()) {
            // TODO: lol does this work?
            handler.add(new HelpCommand(lang, handler));
        }

        for (const [lang, handler] of this.handlers.entries()) {
            for (const imageGenCommandData of imageGenJson) {
                handler?.add(
                    new ImageCommand(imageGenCommandData as ImageGenCommandData, lang, {
                        category: languagesConf.image_gen[lang].category,
                    }),
                );
            }
        }
    }

    public getHandler(language: Language): CommandHandler {
        return this.handlers.get(language)!;
    }
}
