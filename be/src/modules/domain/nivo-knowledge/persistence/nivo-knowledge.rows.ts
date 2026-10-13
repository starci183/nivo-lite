/** Whether an upsert created the item. */
export interface UpsertedNivoRow {
    /** True when the item is new. */
    readonly inserted: boolean
}

/** One item of the base knowledge that needs a vector. */
export interface UnembeddedNivoRow {
    /** The item id. */
    readonly id: string
    /** The title. */
    readonly title: string
    /** The body. */
    readonly body: string
}

/** The id of an item that was removed. */
export interface RemovedNivoRow {
    /** The item id. */
    readonly id: string
}
