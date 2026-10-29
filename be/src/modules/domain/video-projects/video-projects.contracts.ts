/** The project a caller asks to render, as its own row says it. */
export interface LockedProject {
    /** The project id. */
    readonly id: string
    /** The workspace it belongs to. */
    readonly workspaceId: string
    /** The output shape. */
    readonly aspect: string
    /** The project status. */
    readonly status: string
    /** The editable scenes, as stored. */
    readonly script: unknown
    /** The version the next render snapshots. */
    readonly version: number
    /** The render the project points at, or null. */
    readonly renderId: string | null
}

/** The answer of looking a project up for a render: the project, or null when it does not exist. */
export type LockedProjectLookup = LockedProject | null

/** A project that starts a render. */
export interface RenderStart {
    /** The project. */
    readonly projectId: string
    /** The new render. */
    readonly renderId: string
    /** The validated spec as JSON text. */
    readonly spec: string
}

/** One project of the workbench list, with the column names of the database. */
export interface ProjectRow {
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
}

/** A project as script generation reads it from its own row, with the column names of the database. */
export interface ScriptProjectRow {
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
    /** The render the project points at, or null. */
    readonly render_id: string | null
}

/** The projects of a workspace counted by state. */
export interface ProjectCounts {
    /** Projects rendering now. */
    readonly rendering: number
    /** Projects waiting for a script. */
    readonly scripting: number
    /** Projects ready to publish (ready or approved). */
    readonly readyToPublish: number
    /** Approved projects. */
    readonly approved: number
    /** Projects published in the last 30 days. */
    readonly published30: number
}

/** The title of the newest project a render belongs to. */
export interface RenderTitle {
    /** The render. */
    readonly renderId: string
    /** The title of the newest project that holds it. */
    readonly title: string
}

/** What a delegation card shows of a project. */
export interface ProjectCardFacts {
    /** The project title. */
    readonly title: string
    /** The output shape. */
    readonly aspect: string
    /** The scenes, as stored. */
    readonly script: unknown
}

/** The id of one project to read, or null for every project of the workspace. */
export type OptionalProjectId = string | null

/** The project script generation reads, or undefined when the workspace has none with that id. */
export type OptionalScriptProject = ScriptProjectRow | undefined

/** The counts by state, or undefined when the count cannot be read. */
export type OptionalProjectCounts = ProjectCounts | undefined

/** The card facts of a project, or null when the workspace has none with that id. */
export type OptionalProjectCardFacts = ProjectCardFacts | null
