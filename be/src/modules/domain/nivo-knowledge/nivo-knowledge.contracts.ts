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
    /** Items whose `vector.sync` job was written with the change (every item written: the job plans only the difference). */
    readonly queued: number
}

/** What removing the items the folder no longer has did. */
export interface NivoRemoveResult {
    /** Items removed. */
    readonly removed: number
    /** Items whose `vector.sync` job was written with the removal (their points go). */
    readonly queued: number
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
    /** Items whose `vector.sync` job was written: the index embeds what changed and drops what went (the api's worker runs it). */
    readonly queued: number
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
    /** The query vector, or null (words only). */
    readonly vector: ReadonlyArray<number> | null
    /** The embedding identity the vector comes from: only points of it are compared; null with no vector. */
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

/** The title and text of one base-knowledge item, as an agent reads it as a rule. */
export interface NivoRule {
    /** The title. */
    readonly title: string
    /** The text. */
    readonly body: string
}
