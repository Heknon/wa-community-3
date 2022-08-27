import {isJidGroup, proto, WASocket} from "@adiwajshing/baileys";
import {BlockedReason} from "../../../blockable";
import CommandHandler from "../../../handlers/command_handler";
import Message from "../../../../lib/messaging/message";
import Command from "../../command";
import CommandTrigger from "../../command_trigger";
import languages from "../../../config/language.json";
import {applyPlaceholders} from "../../../utils/message_utils";
import {Chat, User} from "../../../db/types";
import {getNumberFromAccountType} from "../../../utils/utils";
import {AccountType} from "@prisma/client";
import {getCommandByTrigger} from "../../../chat/chat";

export default class HelpCommand extends Command {
    private commandHandler: CommandHandler;
    private language: typeof languages.commands.help[Language];
    private langCode: Language;

    constructor(language: Language, commandHandler: CommandHandler) {
        const langs = languages.commands.help;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            description: lang.description,
        });

        this.language = lang;
        this.langCode = language;
        this.commandHandler = commandHandler;
    }

    async execute(
        client: WASocket,
        chat: Chat,
        user: User,
        message: Message,
        body: string,
        trigger: CommandTrigger,
    ) {
        const prefix = chat.prefix;
        const cmdArg = body?.trim().startsWith(prefix) ? body.trim() : prefix + body?.trim();
        const cmdArgRes = await getCommandByTrigger(chat, cmdArg);
        const isBlocked = cmdArgRes
            ? await this.commandHandler.isBlocked(message, chat, cmdArgRes, false)
            : undefined;
        if (
            cmdArgRes &&
            (isBlocked == undefined ||
                ![BlockedReason.BadAccountType, BlockedReason.NotWhitelisted].includes(isBlocked))
        ) {
            let id = 0;
            const desc =
                `*${prefix}${cmdArgRes.name}*\n\n` +
                (await applyPlaceholders(this.getCommandExtendedDescription(cmdArgRes), {
                    message,
                    command: cmdArgRes,
                    chat: chat,
                    user,
                }));
            const buttons: proto.Message.ButtonsMessage.IButton[] = cmdArgRes.announcedAliases.map(
                (alias) => {
                    return {buttonId: (id++).toString(), buttonText: {displayText: prefix + alias}};
                },
            );
            return message.replyAdvanced(
                {text: desc, buttons, footer: `(${prefix}help ${cmdArgRes.name})`},
                true,
            );
        }

        const args = body!.split(" ") as string[];
        let [filteredCommands, sendInGroup] = await this.getFilteredCommands(message, chat);
        const categories = [
            ...new Set(
                filteredCommands.map(
                    (e) => e.category?.toLowerCase() ?? this.language.execution.misc.toLowerCase(),
                ),
            ),
        ];
        const argsSet = new Set(args.map((e) => e.toLowerCase()));
        let allowedCategories = new Set(
            Array.from(categories).filter((cat) => argsSet.has(cat.toLowerCase())),
        );
        let allowedCategoriesList = [...allowedCategories];
        if (allowedCategoriesList.length === 0) {
            allowedCategoriesList = categories;
            allowedCategories = new Set(categories);
        }

        const isSpecificSectionRequest = allowedCategoriesList.length != categories.length;
        const imageGenCategory = languages.image_gen[this.langCode].category.toLowerCase();
        if (!isSpecificSectionRequest) {
            allowedCategories.delete(imageGenCategory);
        }
        let sections = await this.getHelpSections(filteredCommands, chat, message, user, [
            ...allowedCategories,
        ]);

        let helpMessage = `${this.language.execution.prefix}\n${
            isSpecificSectionRequest
                ? (sections.size > 1
                      ? this.language.execution.categories_help
                      : this.language.execution.category_help
                  ).replace(
                      "{category}",
                      Array.from(sections.values())
                          .map((e) => e.title)
                          .join(", "),
                  )
                : ""
        }\n${isSpecificSectionRequest ? "\n" : ""}`;

        if (isSpecificSectionRequest) sendInGroup = true;
        if (!isSpecificSectionRequest) {
            sections = new Map([
                [
                    imageGenCategory,
                    {
                        title: imageGenCategory,
                        rows: [
                            {
                                title: languages.image_gen[this.langCode].title.replace(
                                    "{prefix}",
                                    prefix,
                                ),
                                description: languages.image_gen[this.langCode].description,
                                rowId: `HELP_COMMAND-0\n${Object.values(languages.image_gen)
                                    .map((e) => e.title)
                                    .join("\n")}\n\r`,
                            },
                        ],
                    },
                ],
                ...sections.entries(),
            ]);
        }

        // const sendFull = !["תפריט", "menu"].some((e) => body?.toLowerCase()?.includes(e));
        // if (sendFull) helpMessage += await this.getHelpText(sections);

        // helpMessage += `${this.language.execution.suffix}`;
        // if (sendFull) {
        //     helpMessage += `\n\n${this.language.execution.footer}`;
        // }

        if (
            sendInGroup ||
            ["here", "כאן"].some((e) => message.content?.trim().toLowerCase().includes(e))
        ) {
            // if (!sendFull) await messagingService.reply(message, languages.tagged_info[this.langCode].difference, true);
            await message.replyAdvanced(
                {
                    text: helpMessage,
                    buttonText: this.language.execution.button,
                    sections: Array.from(sections.entries()).map(
                        (arr) => arr[1] as proto.Message.ListMessage.ISection,
                    ),
                    footer: this.language.execution.footer,
                    viewOnce: true,
                },
                true,
            );
        } else {
            if (isJidGroup(message.to))
                message.replyAdvanced({text: this.language.execution.dms}, true);

            // if (!sendFull)
            //     await messagingService.reply(message, languages.tagged_info[this.langCode].difference, true, {
            //         privateReply: true,
            //     });
            await message.replyAdvanced(
                {
                    text: helpMessage,
                    buttonText: this.language.execution.button,
                    sections: Array.from(sections.entries()).map(
                        (arr) => arr[1] as proto.Message.ListMessage.ISection,
                    ),
                    footer: this.language.execution.footer,
                    viewOnce: true,
                },
                true,
                {privateReply: true},
            );
        }
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}

    public async getHelpSections(
        commands: Command[],
        chat: Chat,
        message: Message,
        user: User | undefined,
        allowedCategories: string[],
    ): Promise<Map<string, proto.Message.ListMessage.ISection>> {
        const allowedCategoriesSet = new Set(allowedCategories);

        const sections: Map<string, proto.Message.ListMessage.ISection> = new Map();
        let id = 0;
        for (const command of commands) {
            const sectionKey =
                command.category?.toLowerCase() ?? this.language.execution.misc.toLowerCase();
            if (!allowedCategoriesSet.has(sectionKey)) continue;
            if (!sections.has(sectionKey)) {
                sections.set(sectionKey, {
                    title:
                        command.category?.toUpperCase() ??
                        this.language.execution.misc.toUpperCase(),
                    rows: new Array<proto.Message.ListMessage.IRow>(),
                });
            }

            const section = sections.get(sectionKey);
            const formattedDescription = await applyPlaceholders(
                this.getCommandExtendedDescription(command),
                {
                    message,
                    command,
                    chat,
                    user,
                },
            );
            section?.rows?.push({
                title: chat.prefix + command.name,
                description: await applyPlaceholders(command.description, {
                    message,
                    command,
                    chat,
                    user,
                }),
                rowId: `HELP_COMMAND-${id}\n${command.announcedAliases
                    .map((e) => `{prefix}${e}`)
                    .join("\n")}\n\r${formattedDescription}`,
            });

            id++;
        }

        return sections;
    }

    private async getFilteredCommands(message: Message, chat: Chat): Promise<[Command[], boolean]> {
        const allCommands = this.commandHandler.commands;
        const filteredCommands: Array<Command> = [];
        let sendInGroup = true;

        const toDmLevelThreshold = getNumberFromAccountType(AccountType.MODERATOR);
        for (const command of allCommands) {
            if (!command.mainTrigger.command) continue;
            if (command.mainTrigger.command == this.mainTrigger.command) continue;

            if ((await this.commandHandler.isBlocked(message, chat, command, false)) != undefined)
                continue;

            const commandLevel = getNumberFromAccountType(command.accountType);
            if (commandLevel >= toDmLevelThreshold) sendInGroup = false;
            filteredCommands.push(command);
        }

        return [filteredCommands, sendInGroup];
    }

    public async getHelpText(
        sections: Map<string, proto.Message.ListMessage.ISection>,
    ): Promise<string> {
        let help = "";
        for (const section of sections.values()) {
            help += `*${section.title}*\n`;
            for (const row of section.rows ?? []) {
                help += `● ${row.title}\n${row.description}\n\n`;
            }

            // remove last newline
            help = help.slice(0, -1);
            help += "=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n";
        }

        return applyPlaceholders(help, {command: this});
    }

    private getCommandExtendedDescription(command: Command) {
        return `*${this.language.execution.description}:*\n${command.description}${
            command.extendedDescription ? "\n\n" : ""
        }${command.extendedDescription}\n\n*${this.language.execution.aliases}:*\n${command.triggers
            .map((e) => e.command)
            .join(", ")}\n\n*${this.language.execution.cooldowns}:*\n${Array.from(
            command.cooldowns.entries(),
        )
            .filter(([acc, time]) => !!languages.ranks[this.langCode][acc.toLowerCase()])
            .map(
                (e) =>
                    `${languages.ranks[this.langCode][AccountType[e[0]].toLowerCase()]}: ${
                        e[1] / 1000
                    }s`,
            )
            .join("\n")}`;
    }
}
