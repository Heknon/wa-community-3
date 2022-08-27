import {WASocket} from "@adiwajshing/baileys";
import Message from "../../../../lib/messaging/message";
import CommandTrigger from "../../command_trigger";
import {BlockedReason} from "../../../blockable";
import InteractableCommand from "../../interactable_command";
import languages from "../../../config/language.json";
import {Chat, GroupLevel, User} from "../../../db/types";
import {BotResponse} from "@prisma/client";
import {prisma} from "../../../db/client";

export default class ResponseCommand extends InteractableCommand {
    private language: typeof languages.commands.response[Language];

    constructor(language: Language) {
        const langs = languages.commands.response;
        const lang = langs[language];
        super({
            triggers: langs.triggers.map((e) => new CommandTrigger(e)),
            announcedAliases: lang.triggers,
            usage: lang.usage,
            category: lang.category,
            description: lang.description,
            extendedDescription: lang.extended_description,
            groupLevel: GroupLevel.ADMIN,
        });

        this.language = lang;
    }

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        if (trigger.command == "תגובות" || trigger.command == "responses") {
            this.handleReponsesListRequest(chat, message);
            return;
        }

        const placeholder = this.getDefaultPlaceholder({chat, message});
        await message.reply(this.language.execution.stage1, true, {placeholder});
        const queryFilterMsg = await this.waitForInteractionWith(message, undefined, undefined, 1000 * 30, () => {
            message.reply(this.language.execution.timeout, true, {placeholder});
        });

        if (!queryFilterMsg || !queryFilterMsg.content) return;

        const queryFilter = queryFilterMsg.content.toLowerCase().trim();
        if (chat.responses.find((e) => e.filter == queryFilter)) {
            message.reply(this.language.execution.exists, true, {
                placeholder: this.addCustomPlaceholders(placeholder, {filter: queryFilter}),
            });
            return;
        }

        await queryFilterMsg.reply(this.language.execution.stage2, true, {placeholder});
        const responseMsg = await this.waitForInteractionWith(queryFilterMsg, undefined, undefined, 1000 * 30, () => {
            queryFilterMsg.reply(this.language.execution.timeout, true, {placeholder});
        });

        if (!responseMsg || !responseMsg.content) return;
        const response = responseMsg.content;

        await prisma.botResponse.create({
            data: {
                chat: {connect: {jid: chat.jid}},
                filter: queryFilter,
                includes: true,
                responses: {
                    set: [response],
                },
                equals: false,
                startsWith: false,
            },
        });

        await responseMsg.replyAdvanced(
            {
                text: this.language.execution.creation,
                buttons: [
                    {
                        buttonId: "0",
                        buttonText: {displayText: `${chat.prefix}${this.language.execution.list_command}`},
                    },
                ],
            },
            true,
            {
                placeholder: this.addCustomPlaceholders(placeholder, {
                    filter: queryFilter,
                    response: response,
                }),
            },
        );
    }

    private async handleReponsesListRequest(chat: Chat, message: Message) {
        const responses = chat.responses;
        const [listMsgText, shouldReturn] = this.buildListText(responses);
        const createButtonText = `${chat.prefix}${this.language.execution.create_response_help}`;

        if (shouldReturn) {
            await message.replyAdvanced(
                {text: listMsgText, buttons: [{buttonId: "0", buttonText: {displayText: createButtonText}}]},
                true,
            );
            return;
        }

        await message.replyAdvanced(
            {text: listMsgText, buttons: [{buttonId: "0", buttonText: {displayText: createButtonText}}]},
            true,
        );
        const action = await this.waitForInteractionWith(message, undefined, undefined, 1000 * 30, () => {});
        if (!action) return;

        const actionId = Number(action.content?.toLowerCase().trim().replace(/\D/g, "")) - 1;
        if (!actionId && actionId != 0) return;
        if (actionId < 0 || actionId >= responses.length) return;

        const response = responses[actionId];
        return this.handleResponseEditor(chat, action, response, actionId);
    }

    private async handleResponseEditor(chat: Chat, message: Message, response: BotResponse, index: number) {
        const options = new Map([
            [1, this.language.execution.editMenu.see_responses],
            [2, this.language.execution.editMenu.add_response],
            [3, this.language.execution.editMenu.delete],
        ]);

        const menuOptions = Array.from(options.values())
            .map((e, i) => `${(i + 1).toString()}. ${e.query}`)
            .join("\n");
        const menu = `${this.language.execution.responses_menu.title}\n\n${menuOptions}`;
        await message.reply(menu, true);

        const actionMsg = await this.validatedWaitForInteractionWith(
            message,
            (msg) => msg.reply(menuOptions, true),
            1000 * 30,
            () => {
                message.reply(this.language.execution.timeout, true);
            },
            ...Array.from(options.entries())
                .map((e) => [e[0].toString(), e[1].query.toLowerCase()])
                .flat(),
        );

        if (!actionMsg) return;
        const action = Number(actionMsg.content?.toLowerCase().trim().replace(/\D/g, ""));
        if (!action) return;
        const placeholder = this.getDefaultPlaceholder({chat, message});

        switch (action) {
            case 1:
                const text = `${this.language.execution.editMenu.see_responses.success}\n\n${response.responses
                    .map((e, i) => `*${(i + 1).toString()}.* ${e}`)
                    .join("\n")}`;
                return await message.reply(text, true);
            case 2:
                await actionMsg.reply(this.language.execution.stage2, true, {
                    placeholder,
                });
                const responseMsg = await this.waitForInteractionWith(
                    actionMsg,
                    undefined,
                    undefined,
                    1000 * 30,
                    () => {
                        actionMsg.reply(this.language.execution.timeout, true, {
                            placeholder,
                        });
                    },
                );

                if (!responseMsg || !responseMsg.content) return;
                const responseText = responseMsg.content.toLowerCase().trim();
                await prisma.botResponse.update({
                    where: {id: response.id},
                    data: {
                        responses: {
                            push: [responseText],
                        },
                    },
                });

                await responseMsg.reply(this.language.execution.editMenu.add_response.success, true, {
                    placeholder: this.addCustomPlaceholders(placeholder, {
                        response: responseText,
                        filter: response.filter,
                    }),
                });
                return;
            case 3:
                await prisma.botResponse.delete({where: {id: response.id}});
                await actionMsg.reply(this.language.execution.editMenu.delete.success, true, {
                    placeholder,
                });
                return;
        }
    }

    private buildListText(responses: BotResponse[]): [string, boolean] {
        let listMsgText = `${this.language.execution.responses_menu.title}\n\n`;

        if (!responses || responses.length == 0) {
            return [listMsgText + this.language.execution.responses_menu.empty, true];
        }

        let i = 1;
        for (const response of responses) {
            const filter = response.filter.slice(0, 30);
            const filterText = filter.length != response.filter.length ? `${filter}...` : filter;
            listMsgText +=
                this.language.execution.responses_menu.format
                    .replace("{num}", (i++).toString())
                    .replace("{filter}", filterText) + "\n";
        }

        return [listMsgText, false];
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {
        if (blockedReason == BlockedReason.InsufficientGroupLevel) {
            data.reply(this.language.execution.admin, true);
        }
    }
}
