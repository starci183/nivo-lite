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
export interface KnowledgeInstallationRow {
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

/** One row of the document list; only a single-document read carries the text. */
export interface SourceListRow {
    /** The source id. */
    readonly id: string
    /** The owning workspace. */
    readonly workspace_id: string
    /** The module; null = every module. */
    readonly module: string | null
    /** The agent instance; null = every instance. */
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
    /** Where the source stands. */
    readonly status: string
    /** A stored code or note, or null. */
    readonly error: string | null
    /** How many passages are stored. */
    readonly chunk_count: number
    /** 0-100 while a worker is on it. */
    readonly progress: number
    /** Creation instant. */
    readonly created_at: string | Date
    /** Last change. */
    readonly updated_at: string | Date
    /** The text; present on a single-document read. */
    readonly content?: string
}

/** An indexed document an agent's view may read, with its text. */
export interface ReadableSourceRow {
    /** The source id. */
    readonly id: string
    /** The title. */
    readonly title: string
    /** The topic, or null. */
    readonly topic: string | null
    /** The kind of source. */
    readonly kind: string
    /** public or internal. */
    readonly visibility: string
    /** The text. */
    readonly content: string | null
    /** The module it is for; null = every module. */
    readonly module: string | null
    /** The instance it is kept for; null = every instance. */
    readonly installation_id: string | null
    /** Last change, ISO text. */
    readonly updated_at: string
}

/** A count. */
export interface ReadableCountRow {
    /** How many. */
    readonly count: number
}
