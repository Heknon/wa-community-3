import {ObjectId} from "mongodb";

export default class ReminderModel {
    public readonly _id: ObjectId;
    public readonly jid: string;
    public readonly reminder: string;
    public readonly remindTimestamp: number;

    constructor(id: ObjectId, jid: string, text: string, remindTimestamp: number) {
        this._id = id;
        this.jid = jid;
        this.reminder = text;
        this.remindTimestamp = remindTimestamp;
    }

    public toMap(): Map<string, any> {
        return new Map(
            Object.entries({
                _id: this._id,
                jid: this.jid,
                reminder: this.reminder,
                remind_timestamp: this.remindTimestamp,
            }),
        );
    }

    public static fromMap(map: Map<string, any>) {
        return new ReminderModel(map["_id"], map["jid"], map["reminder"], map["remind_timestamp"]);
    }
}
