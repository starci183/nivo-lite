/** The project to render with everything the spec needs: one joined row of `SELECT_PROJECT_FOR_RENDER`. */
export interface ProjectRenderRow {
    /** The project id. */
    readonly id: string
    /** The workspace it belongs to. */
    readonly workspace_id: string
    /** The output shape. */
    readonly aspect: string
    /** The project status. */
    readonly status: string
    /** The editable scenes, as stored. */
    readonly script: unknown
    /** The version the next render snapshots. */
    readonly version: number
    /** The status of the render the project points at, or null. */
    readonly render_status: string | null
    /** The workspace name. */
    readonly workspace_name: string
    /** The brand kit shop name; null without a kit. */
    readonly shop_name: string | null
    /** The brand kit primary colour. */
    readonly primary_color: string | null
    /** The brand kit secondary colour. */
    readonly secondary_color: string | null
    /** The brand kit logo path in the media bucket. */
    readonly logo_path: string | null
    /** The brand kit music track. */
    readonly music_track: string | null
    /** The brand kit voice. */
    readonly voice: string | null
}
