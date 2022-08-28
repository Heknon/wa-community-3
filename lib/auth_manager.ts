import {AuthenticationState, MessageRetryMap} from "@adiwajshing/baileys";
import {existsSync, mkdirSync} from "fs";
import { useAuthState } from "./auth_state";

export class AuthManager {
    public messageRetryMap: MessageRetryMap;
    private initialized: Promise<{
        result: boolean;
        state: AuthenticationState | undefined;
        saveCreds: (() => Promise<void>) | undefined;
    }>;

    constructor(private authenticationPath: string) {
        this.messageRetryMap = {};

        setInterval(() => {
            // clear references in messageRetryMap
            Object.keys(this.messageRetryMap).forEach((key) => {
                delete this.messageRetryMap[key];
            });
        }, 1000 * 60 * 2);

        this.initialized = new Promise((resolve, reject) => {
            try {
                if (!existsSync(authenticationPath)) {
                    mkdirSync(authenticationPath);
                }
            } catch (e) {
                return reject(e);
            }

            useAuthState()
                .then((e) => {
                    if (!e || !e.state || !e.saveCreds) {
                        reject(e);
                    }

                    resolve({
                        result: true,
                        state: e.state,
                        saveCreds: e.saveCreds,
                    });
                })
                .catch(reject);
        });
    }

    public get isInitialized() {
        return this.initialized.then((e) => e && e.result).catch((e) => false);
    }

    public async saveAuthState(): Promise<void> {
        return this.initialized.then((e) => {
            if (!e.saveCreds) {
                throw new Error("saveCreds not defined");
            }

            return e.saveCreds();
        });
    }

    public async getState(): Promise<AuthenticationState> {
        return this.initialized.then((e) => {
            if (!e.state) {
                throw new Error("state not defined");
            }

            return e.state;
        });
    }
}
