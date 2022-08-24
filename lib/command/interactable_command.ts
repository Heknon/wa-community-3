import {getCommandByTrigger} from "../chat/chat";
import {prisma} from "../db/client";
import Message from "../messaging/message";
import {waitForMessage} from "../utils/message_utils";
import Command from "./command";

export default abstract class InteractableCommand extends Command {
    public async waitForInteractionWith(
        message: Message,
        filter?: (message: Message) => boolean | undefined | Promise<boolean | undefined>,
        onFail?: (message: Message) => any | Promise<any>,
        timeout?: number,
        onTimeout?: () => any | Promise<any>,
    ): Promise<Message | undefined> {
        if (!timeout) timeout = 120 * 1000;
        let timedOut = false;
        let cancelTimeout = false;
        let timerCode: NodeJS.Timer;
        if (timeout !== undefined && timeout > 0) {
            timerCode = setTimeout(async () => {
                timedOut = true;
                if (onTimeout && !cancelTimeout) await onTimeout();
            }, timeout);
        }

        let isCommandFlag = false;
        return waitForMessage(async (msg) => {
            if (timedOut) return true;
            const baseCheck =
                msg.senderJid == message.senderJid &&
                msg.raw?.key.remoteJid == message.raw?.key.remoteJid &&
                (msg.content?.trim()?.length ?? 0) > 0;
            if (!baseCheck) return false;
            const chat = await prisma.chat.findUnique({
                where: {jid: msg.raw?.key.remoteJid!},
            });
            const isCommand = chat ? (await getCommandByTrigger(chat, msg.content ?? '')) != undefined : false;
            isCommandFlag = isCommand;
            if (isCommand) return true;
            if (!filter) {
                clearTimeout(timerCode);
                cancelTimeout = true;
                return true;
            }

            const filterResult = await filter(msg);
            if (filterResult === undefined) {
                clearTimeout(timerCode);
                cancelTimeout = true;
                return true;
            }
            if (!filterResult && onFail) await onFail(msg);
            if (filterResult) {
                clearTimeout(timerCode);
                cancelTimeout = true;
            }
            return filterResult;
        }, timeout + 10 * 1000)
            .then((msg) => {
                if (timedOut) return undefined;
                if (isCommandFlag) return undefined;
                return msg;
            })
            .catch((err) => undefined);
    }

    public async validatedWaitForInteractionWith(
        message: Message,
        onFail?: (message: Message) => any | Promise<any>,
        timeout?: number,
        onTimeout?: () => any | Promise<any>,
        ...validResponses: (string | undefined)[]
    ) {
        const validResponsesNoUndefined: string[] = validResponses.filter(
            (e) => e !== undefined,
        ) as string[];
        return this.waitForInteractionWith(
            message,
            async (msg) => {
                if (
                    validResponsesNoUndefined.some(
                        (e) => msg.content?.trim().toLowerCase()?.startsWith(e) ?? false,
                    )
                )
                    return true;
                return false;
            },
            onFail,
            timeout,
            onTimeout,
        );
    }
}
