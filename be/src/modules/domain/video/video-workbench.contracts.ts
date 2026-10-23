import type { WorkspaceMember } from "@modules/domain/workspace-members"

/** The editable scene kept by the video editor. */
export interface EditorScene {
    /** Stable editor identity. */
    readonly id: string
    /** Hook, body or closing call to action. */
    readonly role: string
    /** Onscreen text. */
    readonly caption: string
    /** Spoken text. */
    readonly voiceover: string
    /** Suggested footage. */
    readonly visual: string
    /** Workspace media object. */
    readonly media: string | null
}

/** The knowledge and files offered to script generation. */
export interface VideoInputs {
    /** Public source identities. */
    readonly sourceIds: ReadonlyArray<string>
    /** Owner instructions. */
    readonly notes: string
    /** Workspace object paths. */
    readonly media: ReadonlyArray<string>
    /** Whether automation created the project. */
    readonly auto: boolean
}

/** A saved render with short lived playback links. */
export interface WorkbenchRender {
    /** Render identity. */
    readonly id: string
    /** Queued, rendering, done or failed. */
    readonly status: string
    /** Completed percent. */
    readonly progress: number
    /** Current processing stage. */
    readonly stage: string | null
    /** Video duration. */
    readonly durationMs: number | null
    /** Output size. */
    readonly sizeBytes: number | null
    /** Stable failure code. */
    readonly errorCode: string | null
    /** Playback address. */
    readonly videoUrl: string | null
    /** A nonempty timed WebVTT artifact; null for legacy or captionless renders. */
    readonly captionsUrl: string | null
    /** Actual caption locale when recorded, otherwise null. */
    readonly captionsLang: string | null
    /** Download address. */
    readonly downloadUrl: string | null
    /** Poster address. */
    readonly posterUrl: string | null
}

/** A project's render, or no render before the first request. */
export type MaybeWorkbenchRender = WorkbenchRender | null

/** One project of the video workbench. */
export interface WorkbenchProject {
    /** Project identity. */
    readonly id: string
    /** Working title. */
    readonly title: string
    /** Business goal. */
    readonly goal: string
    /** Output shape. */
    readonly aspect: string
    /** Target duration in seconds. */
    readonly targetSeconds: number
    /** Saved project state. */
    readonly status: string
    /** Input sources and media. */
    readonly inputs: VideoInputs
    /** Editable script scenes. */
    readonly script: ReadonlyArray<EditorScene>
    /** Next version number. */
    readonly version: number
    /** Duration of the script run. */
    readonly scriptMs: number | null
    /** Stable latest failure code. */
    readonly lastErrorCode: string | null
    /** Latest render. */
    readonly render: MaybeWorkbenchRender
    /** Number of renders. */
    readonly renderCount: number
    /** Approval instant. */
    readonly approvedAt: string | null
    /** Approver display name. */
    readonly approvedByName: string | null
    /** Owner publication instant. */
    readonly publishedAt: string | null
    /** Creation instant. */
    readonly createdAt: string
    /** Last change instant. */
    readonly updatedAt: string
}

/** A project paired with the membership that authorizes manager operations. */
export interface ManagedVideoProject {
    /** The owner's or manager's active membership. */
    readonly member: WorkspaceMember
    /** The project inside that member's selected workspace. */
    readonly project: WorkbenchProject
}

/** Fields of a new draft. */
export interface NewWorkbenchProject {
    /** Working title. */
    readonly title?: string | undefined
    /** Business goal. */
    readonly goal: string
    /** Output shape. */
    readonly aspect: string
    /** Target seconds. */
    readonly targetSeconds: number
    /** Sources and instructions. */
    readonly inputs?: VideoInputs | undefined
}

/** Editable fields of an idle project. */
export interface WorkbenchProjectPatch {
    /** Working title. */
    readonly title?: string | undefined
    /** Business goal. */
    readonly goal?: string | undefined
    /** Output shape. */
    readonly aspect?: string | undefined
    /** Target seconds. */
    readonly targetSeconds?: number | undefined
    /** Sources and instructions. */
    readonly inputs?: VideoInputs | undefined
    /** Editable scenes. */
    readonly script?: ReadonlyArray<EditorScene> | undefined
}

/** A public source offered in the video picker. */
export interface VideoSourceChoice {
    /** Source identity. */
    readonly id: string
    /** Saved title. */
    readonly title: string
    /** Topic tag. */
    readonly topic: string | null
    /** Short public preview. */
    readonly excerpt: string
}

/** Activity figures for the last month. */
export interface WorkbenchFigures {
    /** Projects rendering now. */
    readonly rendering: number
    /** Projects writing scripts now. */
    readonly scripting: number
    /** Ready and approved projects. */
    readonly readyToPublish: number
    /** Approved projects. */
    readonly approved: number
    /** Projects published within 30 days. */
    readonly published30: number
    /** Video AI credits within 30 days. */
    readonly credits30: number
}

/** One uploaded image or clip. */
export interface VideoMediaItem {
    /** Workspace object path. */
    readonly path: string
    /** Display name. */
    readonly name: string
    /** Image or video. */
    readonly kind: string
    /** Signed preview address. */
    readonly url: string | null
}

/** Facts checked before issuing an upload ticket. */
export interface VideoMediaFile {
    /** File name. */
    readonly name: string
    /** MIME type. */
    readonly type: string
    /** Byte length. */
    readonly size: number
}

/** One signed upload address for a private workspace file. */
export interface VideoMediaTicket {
    /** Workspace object path. */
    readonly path: string
    /** Storage upload token. */
    readonly token: string
    /** Signed upload address. */
    readonly signedUrl: string
}

/** Membership selected by the active workspace. */
export interface VideoWorkbenchScope {
    /** Workspace identity. */
    readonly workspaceId: string
    /** Whether caller may edit. */
    readonly canEdit: boolean
}
