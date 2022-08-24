import {Reminder} from "@prisma/client";
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
            
            const checkTime = new Date();
            for (const [id, reminder] of this.repository) {
                if (reminder.time <= checkTime) {
                    await messagingService.sendMessage(reminder.sentTo, {text: `*⏰Reminder*\n\n${reminder.message}`});
                    this.delete(reminder);
                }
            }

            isExecuting = false;
        }, 1000 * 5);
    }

    update(reminder: Reminder): boolean {
        this.updateLocal(reminder);
        return true;
    }

    delete(reminder: Reminder): boolean {
        this.repository.delete(reminder.id);
        return true;
    }

    private updateLocal(reminder: Reminder): void {
        this.repository.set(reminder.id, reminder);
    }
}
