import { WASocket } from "@adiwajshing/baileys";

export function normalizeUserId(id: string): string {
    return id.split(":")[0] + "@s.whatsapp.net";
}

export function getClientID(client: WASocket): string {
    return normalizeUserId(client.user?.id ?? '');
}