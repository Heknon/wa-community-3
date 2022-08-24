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
            
            const deletions: Promise<boolean>[] = [];
            const checkTime = new Date();
            for (const [id, reminder] of this.repository) {
                if (reminder.time <= checkTime) {
                    await messagingService.sendMessage(reminder.sentTo, {text: `*⏰Reminder*\n\n${reminder.message}`});
                    deletions.push(this.delete(reminder));
                }
            }

            await Promise.all(deletions)
            isExecuting = false;
        }, 1000 * 5);
    }

    update(reminder: Reminder): boolean {
        this.updateLocal(reminder);
        return true;
    }

    async delete(reminder: Reminder): Promise<boolean> {
        this.repository.delete(reminder.id);
        const res = await prisma.reminder.delete({where: {id: reminder.id}}).catch(e => false);
        return !!res;
    }

    private updateLocal(reminder: Reminder): void {
        this.repository.set(reminder.id, reminder);
    }
}
