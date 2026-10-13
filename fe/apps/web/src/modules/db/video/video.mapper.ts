import type { Database } from "../../../../../../../supabase/types/database.types"
import { ASPECTS, DEFAULT_VOICE, SCRIPT_STALE_MS, isGoal, isRecord, readInputs, readScript } from "@/modules/video"
import type { Aspect, Brand, ProjectStatus, ProjectView, RenderView } from "@/modules/video"

/** One video_projects row from the generated database contract. */
export type ProjectRow = Database["public"]["Tables"]["video_projects"]["Row"]

/** One video_renders row from the generated database contract. */
export type RenderRow = Database["public"]["Tables"]["video_renders"]["Row"]

/** One video_brand_kits row from the generated database contract. */
export type BrandRow = Database["public"]["Tables"]["video_brand_kits"]["Row"]

/** The signed links of a finished render. */
export interface RenderUrls {
    /** Playback URL. */
    readonly videoUrl: string | null
    /** Download URL. */
    readonly downloadUrl: string | null
    /** Poster URL. */
    readonly posterUrl: string | null
}

/** Turns a stored error code into a sentence in the reader language. */
export type ErrorText = (code: string) => string

/** The columns of video_projects the screens read. */
export const PROJECT_COLUMNS = "*"

/** Marks an error stored as a code of the video catalog instead of a sentence. */
export const ERROR_CODE_PREFIX = "code:"

/** Every project status. */
const STATUSES: ReadonlyArray<ProjectStatus> = [
    "draft",
    "scripting",
    "rendering",
    "ready",
    "approved",
    "published",
    "archived",
]

/** The render states. */
const RENDER_STATES: ReadonlyArray<RenderView["status"]> = ["queued", "rendering", "done", "failed"]

const statusOf = (value: string): ProjectStatus => STATUSES.find((status) => status === value) ?? "draft"

const aspectOf = (value: string): Aspect => ASPECTS.find((aspect) => aspect === value) ?? "9:16"

const renderStateOf = (value: string): RenderView["status"] =>
    RENDER_STATES.find((state) => state === value) ?? "queued"

/** The error text of a stored value: a code is resolved from the catalog, anything else is shown as stored. */
export const errorTextOf = (stored: string | null, resolve: ErrorText): string | null => {
    if (stored === null || stored === "") return null
    return stored.startsWith(ERROR_CODE_PREFIX) ? resolve(stored.slice(ERROR_CODE_PREFIX.length)) : stored
}

const startedAtOf = (row: ProjectRow): number => {
    const meta = isRecord(row.script_meta) ? row.script_meta : {}
    return Date.parse(typeof meta.started_at === "string" ? meta.started_at : row.updated_at)
}

/** Whether a script that was started long ago never came back. */
export const isScriptStale = (row: ProjectRow, now: number): boolean => {
    const started = startedAtOf(row)
    return Number.isFinite(started) && now - started > SCRIPT_STALE_MS
}

interface Shown {
    readonly status: ProjectStatus
    readonly error: string | null
}

/**
 * What a project shows when its job lags: a "rendering" project whose render already finished is shown ready, a failed render
 * as a draft with the reason, a script that never came back as a draft. Display only; nothing is written.
 */
const shownOf = (row: ProjectRow, render: RenderRow | null, now: number, resolve: ErrorText): Shown => {
    const status = statusOf(row.status)
    const stored = errorTextOf(row.last_error, resolve)
    if (status === "rendering" && render?.status === "done") return { status: "ready", error: null }
    if (status === "rendering" && render?.status === "failed") {
        return { status: "draft", error: stored ?? render.error ?? resolve("renderFailed") }
    }
    if (status === "rendering" && render === null) return { status: "draft", error: resolve("renderMissing") }
    if (status === "scripting" && isScriptStale(row, now)) return { status: "draft", error: resolve("scriptSlow") }
    return { status, error: stored }
}

/** The render of a project as the screens show it. */
export const renderViewOf = (render: RenderRow, urls: RenderUrls): RenderView => ({
    id: render.id,
    status: renderStateOf(render.status),
    progress: render.progress,
    stage: render.stage,
    durationMs: render.duration_ms,
    sizeBytes: render.size_bytes,
    error: render.error,
    videoUrl: urls.videoUrl,
    downloadUrl: urls.downloadUrl,
    posterUrl: urls.posterUrl,
})

/** A project row (and its render) as the screens show it. */
export const projectViewOf = (
    row: ProjectRow,
    render: RenderRow | null,
    urls: RenderUrls,
    resolve: ErrorText,
    now: number,
): ProjectView => {
    const shown = shownOf(row, render, now, resolve)
    return {
        id: row.id,
        title: row.title,
        goal: isGoal(row.goal) ? row.goal : "custom",
        aspect: aspectOf(row.aspect),
        targetSeconds: row.target_seconds,
        status: shown.status,
        inputs: readInputs(row.inputs),
        script: readScript(row.script),
        version: row.version,
        scriptMs: row.script_ms,
        lastError: shown.error,
        render: render === null ? null : renderViewOf(render, urls),
        renderCount: row.render_ids.length,
        approvedAt: row.approved_at,
        approvedByName: row.approved_by_name,
        publishedAt: row.published_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

/** The brand kit of a workspace; the shop name falls back to the workspace name until the owner saves one. */
export const brandOf = (row: BrandRow | null, workspaceName: string): Brand => {
    if (row === null) {
        return {
            shopName: workspaceName,
            primary: "",
            secondary: "",
            logoPath: null,
            musicTrack: null,
            voice: DEFAULT_VOICE,
        }
    }
    return {
        shopName: row.shop_name === "" ? workspaceName : row.shop_name,
        primary: row.primary_color,
        secondary: row.secondary_color,
        logoPath: row.logo_path,
        musicTrack: row.music_track,
        voice: row.voice,
    }
}

/** A readable file name for the download of a project. */
export const downloadNameOf = (title: string): string => {
    const stem = title
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50)
    return `${stem === "" ? "video" : stem}.mp4`
}
