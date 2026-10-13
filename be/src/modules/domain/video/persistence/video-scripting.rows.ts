/** A project and brand name as script generation reads them. */
export interface VideoScriptingRow {
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
export interface VideoScriptSourceRow {
    /** Document title. */
    readonly title: string
    /** Optional topic. */
    readonly topic: string | null
    /** Public document body. */
    readonly content: string
}

/** The owner's active module configuration, used as instructions rather than document facts. */
export interface VideoScriptSetupRow {
    /** Approved setup snapshot. */
    readonly snapshot: unknown
}

/** A base policy of the marketing agent. */
export interface VideoScriptBaseRow {
    /** Rule title. */
    readonly title: string
    /** Rule body. */
    readonly body: string
}
