import type { Aspect } from "./video.constants"

/** What a video is for. */
export type Goal = "service" | "offer" | "testimonial" | "behind_scenes" | "hiring" | "custom"

/** The part a scene plays in the story. */
export type SceneRole = "hook" | "body" | "cta"

/** Where a project is in its life. */
export type ProjectStatus = "draft" | "scripting" | "rendering" | "ready" | "approved" | "published" | "archived"

/** A goal template: the defaults a new video of that goal starts from. */
export interface GoalTemplate {
    /** The goal it serves. */
    readonly goal: Goal
    /** Default target length in seconds. */
    readonly default_seconds: number
    /** Default frame shape. */
    readonly default_aspect: Aspect
    /** Default music track id, if any. */
    readonly music: string | null
}

/** One scene of the script the owner edits. */
export interface ScriptScene {
    /** Stable id of the scene. */
    readonly id: string
    /** The part the scene plays. */
    readonly role: SceneRole
    /** On-screen words. */
    readonly caption: string
    /** What the voice says; empty means a silent scene. */
    readonly voiceover: string
    /** A suggestion of what to show. */
    readonly visual: string
    /** Path in the media bucket, or null for a colour card. */
    readonly media: string | null
}

/** The workspace brand kit. */
export interface Brand {
    /** Shop name shown in the video. */
    readonly shopName: string
    /** Main colour. */
    readonly primary: string
    /** Second colour. */
    readonly secondary: string
    /** Logo path in the media bucket. */
    readonly logoPath: string | null
    /** Music track id, or null for none. */
    readonly musicTrack: string | null
    /** Voice name. */
    readonly voice: string
}

/** What the video is based on. */
export interface ProjectInputs {
    /** Public knowledge sources. */
    readonly sourceIds: ReadonlyArray<string>
    /** What the owner wants to stress. */
    readonly notes: string
    /** Uploaded media paths offered to the script. */
    readonly media: ReadonlyArray<string>
    /** Created by an automation. */
    readonly auto: boolean
}

/** The render of a project as the screens show it. */
export interface RenderView {
    /** Render id. */
    readonly id: string
    /** Render state. */
    readonly status: "queued" | "rendering" | "done" | "failed"
    /** Percent done. */
    readonly progress: number
    /** Current stage key. */
    readonly stage: string | null
    /** Video length in milliseconds. */
    readonly durationMs: number | null
    /** File size in bytes. */
    readonly sizeBytes: number | null
    /** Failure reason. */
    readonly error: string | null
    /** Playback URL. */
    readonly videoUrl: string | null
    /** Download URL. */
    readonly downloadUrl: string | null
    /** Poster URL. */
    readonly posterUrl: string | null
}

/** A project as the screens show it. */
export interface ProjectView {
    /** Project id. */
    readonly id: string
    /** Working title. */
    readonly title: string
    /** What it is for. */
    readonly goal: Goal
    /** Frame shape. */
    readonly aspect: Aspect
    /** Target length in seconds. */
    readonly targetSeconds: number
    /** Life state. */
    readonly status: ProjectStatus
    /** What it is based on. */
    readonly inputs: ProjectInputs
    /** The editable scenes. */
    readonly script: ReadonlyArray<ScriptScene>
    /** Version counter. */
    readonly version: number
    /** How long the script took, in milliseconds. */
    readonly scriptMs: number | null
    /** Last failure, already in the reader language. */
    readonly lastError: string | null
    /** The current render. */
    readonly render: RenderView | null
    /** How many renders it has had. */
    readonly renderCount: number
    /** When it was approved. */
    readonly approvedAt: string | null
    /** Who approved it. */
    readonly approvedByName: string | null
    /** When the owner posted it. */
    readonly publishedAt: string | null
    /** Creation time. */
    readonly createdAt: string
    /** Last change. */
    readonly updatedAt: string
}

/** A public knowledge source a video may be based on. */
export interface SourceChoice {
    /** Source id. */
    readonly id: string
    /** Title. */
    readonly title: string
    /** Topic. */
    readonly topic: string | null
    /** A short excerpt. */
    readonly excerpt: string
}

/** A file the workspace uploaded to the media bucket. */
export interface MediaItem {
    /** Path in the bucket. */
    readonly path: string
    /** Name shown. */
    readonly name: string
    /** Image or video. */
    readonly kind: "image" | "video"
    /** Short-lived preview URL. */
    readonly url: string | null
}

/** The figures of the dashboard ribbon. */
export interface VideoFigures {
    /** Projects being rendered now. */
    readonly rendering: number
    /** Projects whose script is being written. */
    readonly scripting: number
    /** Rendered and not published yet. */
    readonly readyToPublish: number
    /** Approved projects. */
    readonly approved: number
    /** Projects published in the last 30 days. */
    readonly published30: number
    /** Credits the video AI calls spent in the last 30 days. */
    readonly credits30: number
}

/** A project to create. */
export interface NewProject {
    /** What it is for. */
    readonly goal: Goal
    /** Frame shape. */
    readonly aspect: Aspect
    /** Target length in seconds. */
    readonly targetSeconds: number
    /** Working title; empty for an automatic one. */
    readonly title?: string
    /** What it is based on. */
    readonly inputs?: Partial<ProjectInputs>
}

/** The edits a draft accepts. */
export interface ProjectPatch {
    /** New title. */
    readonly title?: string
    /** New goal. */
    readonly goal?: Goal
    /** New frame shape. */
    readonly aspect?: Aspect
    /** New target length. */
    readonly targetSeconds?: number
    /** New inputs. */
    readonly inputs?: ProjectInputs
    /** New scenes. */
    readonly script?: ReadonlyArray<ScriptScene>
}

/** The file facts the upload ticket needs. */
export interface MediaFileInfo {
    /** File name. */
    readonly name: string
    /** MIME type. */
    readonly type: string
    /** Size in bytes. */
    readonly size: number
}

/** One-shot upload ticket for a file. */
export interface UploadTicket {
    /** Destination path in the media bucket. */
    readonly path: string
    /** Signed upload token. */
    readonly token: string
}

/** Where a shared video went. */
export interface ShareResult {
    /** A line went to Office. */
    readonly office: boolean
    /** The owner chat on Telegram got it too. */
    readonly telegram: boolean
}

/** The workspace a request works in and what the person may do there. */
export interface WorkspaceScope {
    /** Workspace id the screens work in. */
    readonly workspaceId: string
    /** Whether the person may create, render and approve. */
    readonly canEdit: boolean
}
