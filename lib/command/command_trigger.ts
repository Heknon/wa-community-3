import Triggerable from "../blockable/triggerable";

export default class CommandTrigger implements Triggerable<string> {
    public command: string;

    constructor(command: string) {
        this.command = command;
    }

    isTriggered(data: string): boolean {
        return data.trim().toLowerCase().startsWith(this.command.toLowerCase()) ?? false;
    }

    characterMatch(data: string): number {
        const command = this.command.toLowerCase();
        const dataLower = data.toLowerCase().trim();

        let i = 0;
        for (; i < command.length; i++) {
            if (command[i] !== dataLower[i]) break;
        }

        return i;
    }

}