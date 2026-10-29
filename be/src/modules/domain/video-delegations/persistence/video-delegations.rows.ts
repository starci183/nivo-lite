/** A delegation whose render finished or failed, as the delivery reads it. */
export interface DelegationRenderRow {
    /** The delegation. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The render_script work item. */
    readonly work_item_id: string
    /** The project. */
    readonly project_id: string
    /** The delegating module. */
    readonly source_module: string
    /** The target channels. */
    readonly channels: ReadonlyArray<string>
    /** The project title. */
    readonly title: string
    /** The output shape. */
    readonly aspect: string
    /** The stored script. */
    readonly script: unknown
    /** The render. */
    readonly render_id: string
    /** The render status. */
    readonly render_status: string
    /** The length, or null. */
    readonly duration_ms: number | null
    /** The MP4 path, or null. */
    readonly output_path: string | null
    /** The poster path, or null. */
    readonly poster_path: string | null
    /** The VTT path, or null. */
    readonly captions_path: string | null
    /** The captions language, or null. */
    readonly captions_lang: string | null
    /** none, tts or captions_only, or null. */
    readonly voiceover: string | null
    /** The failure, or null. */
    readonly error: string | null
}

/** What a delegation write or lookup answers: enough to find the project it rendered. */
export interface DelegationIdRow {
    /** The delegation. */
    readonly id: string
    /** The project. */
    readonly project_id: string
}
