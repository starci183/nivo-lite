import { createBrowserDbClient } from "@/modules/db/browser"
import { MEDIA_BUCKET } from "@/modules/video"
import type { UploadTicket } from "@/modules/video"

export {
    aspectKey,
    ASPECTS,
    DURATIONS,
    editorHref,
    estimateScriptSeconds,
    GOAL_TEMPLATES,
    MUSIC_TRACKS,
    newScene,
    SCRIPT_MAX_SCENES,
    stepFor,
    TTS_VOICES,
    VIDEO_MAX_SECONDS,
} from "@/modules/video"
export type {
    Aspect,
    Brand,
    EditorStep,
    Goal,
    MediaItem,
    ProjectInputs,
    ProjectStatus,
    ProjectView,
    SceneRole,
    ScriptScene,
    SourceChoice,
} from "@/modules/video"

/** What a ticket request answers: a ticket, or the failure code to show. */
export type TicketAnswer = { readonly ticket: UploadTicket } | { readonly code: string }

/** One file that did not go up. */
export interface UploadFailure {
    /** The file name. */
    readonly name: string
    /** The failure code (err_<code> in the video catalog). */
    readonly code: string
}

/** What an upload run produced. */
export interface UploadResult {
    /** Bucket paths that went up. */
    readonly paths: ReadonlyArray<string>
    /** One entry per file that did not. */
    readonly failures: ReadonlyArray<UploadFailure>
}

/**
 * Uploads files straight from the browser to the workspace media bucket. `requestTicket` is the block's own Server Action (type and size
 * are checked there); the bytes never pass through the app server. Files go up one after another.
 */
export const uploadMediaFiles = async (
    files: ReadonlyArray<File>,
    requestTicket: (file: File) => Promise<TicketAnswer>,
): Promise<UploadResult> => {
    const browser = createBrowserDbClient()
    const sendOne = async (file: File): Promise<string | UploadFailure> => {
        const answer = await requestTicket(file)
        if ("code" in answer) return { name: file.name, code: answer.code }
        const sent = await browser.storage
            .from(MEDIA_BUCKET)
            .uploadToSignedUrl(answer.ticket.path, answer.ticket.token, file, { contentType: file.type })
        return sent.error === null ? answer.ticket.path : { name: file.name, code: "upload" }
    }
    const results = await files.reduce<Promise<ReadonlyArray<string | UploadFailure>>>(
        async (done, file) => [...(await done), await sendOne(file)],
        Promise.resolve([]),
    )
    return {
        paths: results.filter((entry): entry is string => typeof entry === "string"),
        failures: results.filter((entry): entry is UploadFailure => typeof entry !== "string"),
    }
}
