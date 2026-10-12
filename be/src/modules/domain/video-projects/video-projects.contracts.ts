/** The role a member holds in a workspace. */
export type MemberRole = "owner" | "manager" | "staff"

/** The brand kit of the project's workspace; every field is null when the workspace saved none. */
export interface ProjectBrand {
    /** The shop name shown in the video. */
    readonly shopName: string | null
    /** The accent colour. */
    readonly primary: string | null
    /** The second colour. */
    readonly secondary: string | null
    /** The logo path in the media bucket. */
    readonly logoPath: string | null
    /** The music track id. */
    readonly musicTrack: string | null
    /** The voice name. */
    readonly voice: string | null
}

/** The project a caller asks to render, with the caller's role and everything the spec needs. */
export interface ProjectForRender {
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
    /** The caller's role in the workspace. */
    readonly role: MemberRole
    /** The status of the render the project points at, or null. */
    readonly renderStatus: string | null
    /** The workspace name. */
    readonly workspaceName: string
    /** The brand kit. */
    readonly brand: ProjectBrand
}

/** A project that starts a render. */
export interface RenderStart {
    /** The project. */
    readonly projectId: string
    /** The new render. */
    readonly renderId: string
    /** The validated spec as JSON text. */
    readonly spec: string
}

/** The answer of looking a project up for a render: the project, or null when it does not exist or the caller is no member of its workspace. */
export type ProjectLookup = ProjectForRender | null
