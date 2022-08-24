export default class Metadata {
    public meta: Map<string, any>;

    constructor(meta: Map<string, any>) {
        this.meta = meta;
    }

    public toMap() {
        return {
            meta: this.meta,
        };
    }

    public static fromMap(map: Map<string, any>) {
        return new Metadata(new Map(Object.entries(map["meta"])));
    }
}
