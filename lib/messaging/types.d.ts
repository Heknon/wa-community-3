import type {User, Chat} from "@prisma/client";
import type Message from "./message";
import type Command from '../command/command';

export type Placeholder = {
    chat?: Chat;
    message?: Message;
    user?: User;
    command?: Command;
    custom?: Map<string, string> | {[key: string]: string};
};
