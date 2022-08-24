import {isJidUser, WASocket} from "@adiwajshing/baileys";
import Message from "../../../../lib/messaging/message";
import CommandTrigger from "../../command_trigger";
import {BlockedReason} from "../../../blockable";
import moment from "moment";
import {pluralForm} from "../../../utils/message_utils";
import InteractableCommand from "../../interactable_command";
import languages from "../../../config/language.json";
import {Chat, User} from "../../../db/types";
import {reminderService} from "../../../services/reminder";
import {prisma} from "../../../db/client";
import {Reminder} from "@prisma/client";

export default class ReminderCommand extends InteractableCommand {
    private language: typeof languages.commands.reminder[Language];
    private langCode: Language;

    constructor(language: Language) {
        const langs = languages.commands.reminder;
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
        this.langCode = language;
    }

    private acceptableTimeTypes = new Set([
        "second",
        "seconds",
        "שניה",
        "שניות",
        "minute",
        "minutes",
        "דקה",
        "דקות",
        "hour",
        "hours",
        "שעה",
        "שעות",
        "day",
        "days",
        "יום",
        "ימים",
        "week",
        "weeks",
        "שבוע",
        "שבועות",
        "month",
        "months",
        "חודש",
        "חודשים",
        "year",
        "years",
        "שנה",
        "שנים",
    ]);

    async execute(client: WASocket, chat: Chat, user: User, message: Message, body: string, trigger: CommandTrigger) {
        if (!body) {
            return await message.reply(this.language.execution.no_body, true, {
                placeholder: {chat: chat, command: this},
            });
        }

        if (body.toLowerCase().startsWith("list") || body.toLowerCase().startsWith("רשימה")) {
            return await this.listReminders(chat, message);
        }

        const splitBody = body.split(" ");
        const time = Number(splitBody.shift());
        let timeType = splitBody.shift();
        timeType = timeType
            ?.replace(/min$|m$/gi, "minute")
            .replace(/sec$|s$/gi, "second")
            .replace(/h$/gi, "hour");
        if (!time) {
            return await message.reply(this.language.execution.no_body, true, {
                placeholder: {chat: chat, command: this},
            });
        } else if (!this.acceptableTimeTypes.has(timeType?.toLowerCase() ?? "") || !timeType) {
            const connectedString = this.buildAcceptableTimesString();
            return await message.reply(this.language.execution.valid_times, true, {
                placeholder: {chat: chat, command: this, custom: new Map([["list", connectedString]])},
            });
        }

        const acceptableTimeTypesArr = Array.from(this.acceptableTimeTypes);
        timeType =
            acceptableTimeTypesArr[
                acceptableTimeTypesArr.indexOf(timeType.toLowerCase()) -
                    (acceptableTimeTypesArr.indexOf(timeType.toLowerCase()) % 4)
            ];
        if (!timeType) {
            const connectedString = this.buildAcceptableTimesString();
            return await message.reply(this.language.execution.valid_times, true, {
                placeholder: {chat: chat, command: this, custom: new Map([["list", connectedString]])},
            });
        }

        const reminderText = splitBody.join(" ");
        if (!reminderText) {
            return await message.reply(this.language.execution.no_body, true, {
                placeholder: {chat: chat, command: this},
            });
        }

        const remindTime = moment()
            .utc()
            .add(time, timeType as moment.unitOfTime.Base);
        if (remindTime.diff(moment().utc(), "seconds") < 59) {
            return await message.reply(this.language.execution.too_little_time, true, {
                placeholder: {chat: chat, command: this},
            });
        }

        if (!user) {
            return await message.reply(this.language.execution.error);
        }

        const isDMChat = isJidUser(chat.jid);
        const isDMReminder = isDMChat ? true : await this.isDMReminder(message);
        if (isDMReminder == undefined) return;
        if (!message.senderJid && !message.raw?.key.remoteJid) {
            return await message.reply(this.language.execution.error);
        }

        const reminder = await prisma.reminder
            .create({
                data: {
                    sentTo: isDMReminder ? message.senderJid! : message.raw?.key.remoteJid!,
                    message: reminderText,
                    time: moment()
                        .utc()
                        .add(time, timeType as moment.unitOfTime.Base)
                        .toISOString(),
                },
            })
            .catch((e) => {
                message.reply(this.language.execution.error);
                return undefined;
            });

        if (!reminder) {
            return;
        }

        await message.reply(this.language.execution.success, true, {
            placeholder: {
                chat: chat,
                command: this,
                custom: new Map([
                    ["text", reminderText],
                    ["time", time.toString()],
                    ["time_type", pluralForm(time, languages.times[this.langCode][timeType])],
                ]),
            },
        });
    }

    private buildAcceptableTimesString() {
        let connectedString = "";
        // build string from acceptable time types grouping in groups of four seperated by new line
        let index = 0;
        for (const timeType of this.acceptableTimeTypes.keys()) {
            if (index % 4 === 0) {
                connectedString += "\n";
            }
            connectedString += `${timeType}, `;
            index++;
        }
        // remove last comma and space
        connectedString = connectedString.slice(0, -2);
        return connectedString;
    }

    private async listReminders(chat: Chat, message: Message) {
        if (!message.raw?.key.remoteJid) {
            return message.reply(this.language.execution.error);
        }

        const reminders = await prisma.reminder.findMany({where: {sentTo: message.raw.key.remoteJid}});
        let text = `${this.language.execution.list_title}\n\n`;
        const reminderMapId: Map<number, Reminder> = new Map();
        let id = 1;

        for await (const reminder of reminders) {
            text += `*${id}.* ${reminder.message}\n`;
            reminderMapId.set(id, reminder);
            id++;
        }
        // remove last new line
        text = text.slice(0, -1);
        if (id == 1) {
            return await message.reply(this.language.execution.list_empty);
        }

        await message.reply(text, true);
        let recvMsg = await this.waitForInteractionWith(message);
        if (!recvMsg) return;

        if (!recvMsg.content) return;
        const selectedReminderId = Number(recvMsg.content);
        if (!selectedReminderId) return;
        if (!reminderMapId.has(selectedReminderId)) return;

        const selectedReminder = reminderMapId.get(selectedReminderId);
        if (!selectedReminder) return;
        const isDMChat = isJidUser(chat.jid);
        const modificationMenuMessage =
            `${this.language.execution.change_menu.title}\n\n*1.* ${this.language.execution.change_menu.text}\n` +
            (isDMChat
                ? `*2.* ${this.language.execution.change_menu.delete}\n*3.* ${this.language.execution.change_menu.cancel}`
                : `*2.* ${this.language.execution.change_menu.dm}\n*3.* ${this.language.execution.change_menu.delete}\n*4.* ${this.language.execution.change_menu.cancel}`);
        await message.reply(modificationMenuMessage, true);
        recvMsg = await this.validatedWaitForInteractionWith(
            message,
            (msg) => message.reply(modificationMenuMessage),
            undefined,
            undefined,
            "1",
            "2",
            "3",
            isDMChat ? undefined : "4",
            "cancel",
            "ביטול",
        );
        if (!recvMsg) return;

        const receivedContent = recvMsg.content!.toLowerCase().replace("ביטול", "cancel").replace("cancel", "3");
        if (receivedContent.startsWith("1")) {
            await message.reply(this.language.execution.text_change);
            recvMsg = await this.waitForInteractionWith(message);
            if (!recvMsg) return;

            const newReminderText = recvMsg.content!;
            reminderService.update(
                await prisma.reminder.update({
                    where: {id: selectedReminder.id},
                    data: {message: newReminderText},
                }),
            );
            await message.reply(this.language.execution.success_text_change, false, {
                placeholder: {custom: new Map([["text", newReminderText]])},
            });
        } else if (receivedContent.startsWith("2") && !isDMChat) {
            const isDM = await this.isDMReminder(message);
            if (isDM == undefined) return;
            reminderService.update(
                await prisma.reminder.update({
                    where: {id: selectedReminder.id},
                    data: {
                        sentTo: isDM ? message.senderJid! : chat.jid,
                    },
                }),
            );
            return await message.reply(this.language.execution.success_dm_update);
        } else if ((receivedContent.startsWith("3") && !isDMChat) || (receivedContent.startsWith("2") && isDMChat)) {
            await prisma.reminder.delete({where: {id: selectedReminder.id}});
            reminderService.delete(selectedReminder);
            return await message.reply(this.language.execution.success_delete);
        } else if ((receivedContent.startsWith("4") && !isDMChat) || (receivedContent.startsWith("3") && isDMChat)) {
            return await message.reply(this.language.execution.success_cancel);
        }
    }

    private async isDMReminder(message: Message) {
        let isDM = false;
        const shouldDMMessage = this.language.execution.where_to_send_question;
        await message.reply(shouldDMMessage, true);
        let recvMsg = await this.validatedWaitForInteractionWith(
            message,
            (msg) => message.reply(shouldDMMessage),
            undefined,
            undefined,
            "1",
            "2",
            "3",
            "yes",
            "no",
            "כן",
            "לא",
            "cancel",
            "ביטול",
        );
        if (!recvMsg) return;

        const receivedContent = recvMsg
            .content!.toLowerCase()
            .replace("לא", "no")
            .replace("no", "2")
            .replace("כן", "yes")
            .replace("yes", "1")
            .replace("ביטול", "cancel")
            .replace("cancel", "3");
        if (receivedContent.startsWith("3")) {
            await message.reply(this.language.execution.creation_cancel);
            return undefined;
        }

        isDM = receivedContent.startsWith("1");
        return isDM;
    }

    onBlocked(data: Message, blockedReason: BlockedReason) {}
}
