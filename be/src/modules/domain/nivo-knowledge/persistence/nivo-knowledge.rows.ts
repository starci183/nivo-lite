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

/** One item of the base knowledge as the Knowledge page reads it. */
export interface NivoEntryRow {
    /** The item id. */
    readonly id: string
    /** The module folder, or core. */
    readonly module: string
    /** The stable slug. */
    readonly slug: string
    /** The title. */
    readonly title: string
    /** The markdown body. */
    readonly body: string
    /** playbook, authority, escalation, setup_checklist or tone. */
    readonly kind: string
    /** The version of the text. */
    readonly version: number
    /** Last change. */
    readonly updated_at: string | Date
}
