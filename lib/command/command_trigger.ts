import Triggerable from "../blockable/triggerable";

export default class CommandTrigger implements Triggerable<string> {
    public command: string;

    constructor(command: string) {
        this.command = command;
    }

    isTriggered(data: string): boolean {
        return data.trim().toLowerCase().startsWith(this.command.toLowerCase()) ?? false;
    }

}