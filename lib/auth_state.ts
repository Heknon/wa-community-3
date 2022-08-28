import {
    AuthenticationCreds,
    AuthenticationState,
    BufferJSON,
    initAuthCreds,
    proto,
    SignalDataTypeMap,
} from "@adiwajshing/baileys";
import {redisBotAuth} from "./db/client";

export const useAuthState = async (): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
}> => {
    const writeData = (data: any, key: string) => {
        return redisBotAuth.set(key, JSON.stringify(data, BufferJSON.replacer));
    };

    const readData = async (key: string) => {
        try {
            const data = await redisBotAuth.get(key);
            return data ? JSON.parse(data, BufferJSON.reviver) : null;
        } catch (error) {
            return null;
        }
    };

    const removeData = async (key: string) => {
        try {
            await redisBotAuth.del(key);
        } catch {}
    };

    const creds: AuthenticationCreds = (await readData("")) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type: keyof SignalDataTypeMap, ids: string[]) => {
                    const data: {[_: string]: SignalDataTypeMap[typeof type]} = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}:${id}`);
                            if (type === "app-state-sync-key" && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }

                            data[id] = value;
                        }),
                    );

                    return data;
                },
                set: async (data) => {
                    const tasks: Promise<any>[] = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}:${id}`;
                            tasks.push(value ? writeData(value, key) : removeData(key));
                        }
                    }

                    await Promise.all(tasks);
                },
            },
        },
        saveCreds: async () => {
            await writeData(creds, "");
            return;
        },
    };
};
