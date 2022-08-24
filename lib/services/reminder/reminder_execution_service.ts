import {isJidGroup, isJidUser} from "@adiwajshing/baileys";
import {Reminder} from "@prisma/client";
import {whatsappBot} from "../..";
import {prisma} from "../../db/client";
import {messagingService} from "../../messaging";

export default class ReminderExecutionService {
    private readonly repository: Map<string, Reminder> = new Map<string, Reminder>();

    constructor() {
        prisma.reminder.findMany({}).then((reminders) => {
            reminders.forEach((reminder) => {
                this.updateLocal(reminder);
            });

            this.setupExecutionService();
        });
    }

    private setupExecutionService() {
        let isExecuting = false;

        setInterval(async () => {
            if (isExecuting) return;
            isExecuting = true;

            const deletions: Promise<boolean>[] = [];
            const checkTime = new Date();
            for (const [id, reminder] of this.repository) {
                if (reminder.time <= checkTime) {
                    if (
                        isJidUser(reminder.sentTo) &&
                        !(await whatsappBot.client?.onWhatsApp(reminder.sentTo))?.[0].exists
                    ) {
                        deletions.push(this.delete(reminder));
                        continue;
                    } else if (isJidGroup(reminder.sentTo)) {
                        try {
                            const res = await whatsappBot.client?.groupMetadata(reminder.sentTo);
                            if (!res) {
                                deletions.push(this.delete(reminder));
                                return;
                            }
                        } catch (err) {
                            deletions.push(this.delete(reminder));
                            return;
                        }
                    }

                    await messagingService.sendMessage(reminder.sentTo, {
                        text: `*⏰Reminder*\n\n${reminder.message}`,
                    });
                    deletions.push(this.delete(reminder));
                }
            }

            await Promise.all(deletions);
            isExecuting = false;
        }, 1000 * 5);
    }

    update(reminder: Reminder): boolean {
        this.updateLocal(reminder);
        return true;
    }

    async delete(reminder: Reminder): Promise<boolean> {
        this.repository.delete(reminder.id);
        const res = await prisma.reminder.delete({where: {id: reminder.id}}).catch((e) => false);
        return !!res;
    }

    private updateLocal(reminder: Reminder): void {
        this.repository.set(reminder.id, reminder);
    }
}
