/** One item of the base knowledge of NIVO, as the resource files hold it. */
export interface NivoItemInput {
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
}

/** What writing the items did. */
export interface NivoWriteResult {
    /** Items written for the first time. */
    readonly inserted: number
    /** Items that already existed (changed or not). */
    readonly updated: number
}

/** One item that needs a vector, with the text to embed. */
export interface NivoUnembedded {
    /** The item id. */
    readonly id: string
    /** The text to embed: title and body. */
    readonly text: string
}

/** Vectors to give to items. */
export interface NivoVectorWrite {
    /** The model that made the vectors. */
    readonly model: string
    /** The item ids. */
    readonly ids: ReadonlyArray<string>
    /** One vector per id, in the pgvector text form. */
    readonly vectors: ReadonlyArray<string>
}

/** The knowledge folder to read, or undefined for the default one. */
export type MaybeFolder = string | undefined

/** What publishing the base knowledge did. */
export interface NivoSeedResult {
    /** Items written for the first time. */
    readonly inserted: number
    /** Items that already existed (changed or not). */
    readonly updated: number
    /** Items removed because the folder no longer has them. */
    readonly removed: number
    /** Items given a vector. */
    readonly embedded: number
}

/** One item of the base knowledge as the Knowledge page lists it. */
export interface NivoEntry {
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
    /** Last change, ISO 8601. */
    readonly updatedAt: string
}

/** What a search of the base knowledge asks. */
export interface NivoQuery {
    /** The module of the reader: its own items and those of the core folder. */
    readonly module: string
    /** The query vector in the pgvector text form, or null. */
    readonly vector: string | null
    /** The model the vector comes from; items of another model score by words only. */
    readonly model: string | null
    /** The words of the query as a tsquery text (`a | b`), or null. */
    readonly tsquery: string | null
    /** The most items wanted. */
    readonly limit: number
}

/** One item of the base knowledge a search found. */
export interface NivoHit {
    /** The item id. */
    readonly id: string
    /** The module folder, or core. */
    readonly module: string
    /** The kind of the item. */
    readonly kind: string
    /** The title. */
    readonly title: string
    /** The markdown body. */
    readonly content: string
    /** The relevance, higher first. */
    readonly score: number
}
