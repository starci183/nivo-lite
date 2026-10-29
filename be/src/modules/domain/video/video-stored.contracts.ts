/** Shapes the video queries select: the stored columns of a project, its render, its brand kit and its sources, as the database names them. */

/** One stored video render. */
export interface StoredRender {
    /** Identity. */
    readonly id: string
    /** State. */
    readonly status: string
    /** Progress. */
    readonly progress: number
    /** Stage. */
    readonly stage: string | null
    /** Duration. */
    readonly duration_ms: number | null
    /** Byte length. */
    readonly size_bytes: number | null
    /** Output path. */
    readonly output_path: string | null
    /** Caption artifact recorded by newer renders; absent on legacy rows. */
    readonly captions_path?: string | null
    /** Recorded caption locale, when known. */
    readonly captions_lang?: string | null
    /** Poster path. */
    readonly poster_path: string | null
}

/** A joined render row, or no render before the first request. */
export type MaybeStoredRender = StoredRender | null

/** A project row joined to its current render. */
export interface StoredProject {
    /** Identity. */
    readonly id: string
    /** Working title. */
    readonly title: string
    /** Goal. */
    readonly goal: string
    /** Shape. */
    readonly aspect: string
    /** Seconds. */
    readonly target_seconds: number
    /** State. */
    readonly status: string
    /** Stored inputs. */
    readonly inputs: unknown
    /** Stored script. */
    readonly script: unknown
    /** Version. */
    readonly version: number
    /** Script duration. */
    readonly script_ms: number | null
    /** Stored failure. */
    readonly last_error: string | null
    /** Latest render identity. */
    readonly render_id: string | null
    /** Historical render identities. */
    readonly render_ids: ReadonlyArray<string>
    /** Approval instant. */
    readonly approved_at: Date | string | null
    /** Approver name. */
    readonly approved_by_name: string | null
    /** Publication instant. */
    readonly published_at: Date | string | null
    /** Creation instant. */
    readonly created_at: Date | string
    /** Update instant. */
    readonly updated_at: Date | string
    /** Joined render. */
    readonly render: MaybeStoredRender
}

/** Joined brand kit and workspace fallback. */
export interface StoredBrand {
    /** Workspace name. */
    readonly workspace_name: string
    /** Saved shop name. */
    readonly shop_name: string | null
    /** Main color. */
    readonly primary_color: string | null
    /** Second color. */
    readonly secondary_color: string | null
    /** Logo object. */
    readonly logo_path: string | null
    /** Music choice. */
    readonly music_track: string | null
    /** Voice choice. */
    readonly voice: string | null
}

/** Source picker row. */
export interface StoredSource {
    /** Source identity. */
    readonly id: string
    /** Title. */
    readonly title: string
    /** Topic. */
    readonly topic: string | null
    /** Public preview. */
    readonly excerpt: string
}

/** A project and brand name as script generation reads them. */
export interface ScriptProject {
    /** Project id. */
    readonly id: string
    /** Project title. */
    readonly title: string
    /** Business goal. */
    readonly goal: string
    /** Output aspect ratio. */
    readonly aspect: string
    /** Target duration. */
    readonly target_seconds: number
    /** Saved lifecycle state. */
    readonly status: string
    /** Selected sources, owner notes and media. */
    readonly inputs: unknown
    /** Durable operation and retry metadata. */
    readonly script_meta: unknown
    /** Last row change, used for old operation expiry. */
    readonly updated_at: Date | string
    /** Current render state, if any. */
    readonly render_status: string | null
    /** Workspace name, used when a brand has no name. */
    readonly workspace_name: string
    /** Explicit brand name. */
    readonly shop_name: string | null
}

/** Public document text selected by the script's customer lens. */
export interface ScriptSource {
    /** Document title. */
    readonly title: string
    /** Optional topic. */
    readonly topic: string | null
    /** Public document body. */
    readonly content: string
}

/** The owner's active module configuration, used as instructions rather than document facts. */
export interface ScriptSetup {
    /** Approved setup snapshot. */
    readonly snapshot: unknown
}

/** A base policy of the marketing agent. */
export interface ScriptBase {
    /** Rule title. */
    readonly title: string
    /** Rule body. */
    readonly body: string
}
