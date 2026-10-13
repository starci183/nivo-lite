/** One row of public.knowledge_sources. */
export interface KnowledgeSourcesRow {
    /** The source id. */
    readonly id: string
    /** The owning workspace. */
    readonly workspace_id: string
    /** The module (agent type) the document is for; null = every module. */
    readonly module: string | null
    /** The agent instance the document is kept for; null = every instance. */
    readonly installation_id: string | null
    /** text, faq, file or url. */
    readonly kind: string
    /** The topic label. */
    readonly topic: string | null
    /** The tags. */
    readonly tags: ReadonlyArray<string>
    /** public or internal. */
    readonly visibility: string
    /** The title. */
    readonly title: string
    /** The text (the address of a link source until the worker replaces it). */
    readonly content: string
    /** Where the source stands. */
    readonly status: string
    /** A stored code or note, or null. */
    readonly error: string | null
    /** How many passages are stored. */
    readonly chunk_count: number
    /** 0-100 while a worker is on it. */
    readonly progress: number
    /** The storage object of a file source. */
    readonly storage_path: string | null
    /** The address of a link source. */
    readonly source_url: string | null
    /** Where it came from. */
    readonly origin: string | null
    /** Who added it; null for an API key. */
    readonly created_by: string | null
    /** Creation instant. */
    readonly created_at: string
    /** Last change. */
    readonly updated_at: string
}

/** The agent instance a document may be kept for. */
export interface InstallationRow {
    /** The instance id. */
    readonly id: string
    /** The module (agent type) of the instance. */
    readonly module_key: string
}

/** The id of a source that was written. */
export interface SourceIdRow {
    /** The source id. */
    readonly id: string
}

/** The title of a source that was deleted. */
export interface SourceTitleRow {
    /** The title. */
    readonly title: string
}

/** A generated id. */
export interface GeneratedIdRow {
    /** The id. */
    readonly id: string
}
