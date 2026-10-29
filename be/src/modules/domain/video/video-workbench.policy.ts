import { isRecord } from "@modules/platform/primitives"
import type { EditorScene, MaybeWorkbenchRender, VideoInputs, WorkbenchProject } from "./video-workbench.contracts"
import type { StoredProject } from "./video-stored.contracts"

/** Supported video editor goals. */
export const VIDEO_GOALS = ["service", "offer", "testimonial", "behind_scenes", "hiring", "custom"] as const

/** An object's JSON fields, excluding arrays. */
export const videoRecord = (raw: unknown): Record<string, unknown> => (isRecord(raw) && !Array.isArray(raw) ? raw : {})

/** Whether a path stays below this workspace folder. */
export const workspaceMediaPath = (path: string, workspaceId: string): boolean =>
    path.startsWith(`${workspaceId}/`) && !path.includes("..") && !path.includes("\\") && !path.includes("%")

/** Clean owner inputs with no paths outside this workspace. */
export const videoInputsOf = (raw: unknown, workspaceId: string): VideoInputs => {
    const input = videoRecord(raw)
    const sourceIds = input.source_ids ?? input.sourceIds
    return {
        sourceIds: Array.isArray(sourceIds)
            ? sourceIds
                  .filter(
                      (id): id is string =>
                          typeof id === "string" &&
                          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id),
                  )
                  .slice(0, 12)
            : [],
        notes: typeof input.notes === "string" ? input.notes.trim().slice(0, 600) : "",
        media: Array.isArray(input.media)
            ? input.media
                  .filter((path): path is string => typeof path === "string" && workspaceMediaPath(path, workspaceId))
                  .slice(0, 40)
            : [],
        auto: input.auto === true,
    }
}

/** The saved editor scenes, preserving their stable identities and visual directions. */
export const editorScenesOf = (raw: unknown, workspaceId: string): Array<EditorScene> =>
    (Array.isArray(raw) ? raw : []).slice(0, 12).flatMap((entry: unknown, index): Array<EditorScene> => {
        const scene = videoRecord(entry)
        const text = (key: string, max: number): string =>
            typeof scene[key] === "string" ? scene[key].replace(/\s+/gu, " ").trim().slice(0, max) : ""
        const caption = text("caption", 160)
        const voiceover = text("voiceover", 420)
        if (caption === "" && voiceover === "") return []
        const media = text("media", 300)
        return [
            {
                id: text("id", 60) || `scene-${index + 1}`,
                role: ["hook", "body", "cta"].includes(text("role", 10)) ? text("role", 10) : "body",
                caption,
                voiceover,
                visual: text("visual", 240),
                media: media !== "" && workspaceMediaPath(media, workspaceId) ? media : null,
            },
        ]
    })

/** Stored timestamps represented consistently for GraphQL. */
export const videoInstant = (value: Date | string): string => (value instanceof Date ? value.toISOString() : value)

/** Exposes a saved failure code while keeping legacy provider messages private. */
const lastErrorCodeOf = (error: string | null): string | null => {
    if (error === null) return null
    return error.startsWith("code:") ? error.slice(5) : "VIDEO_PROJECT_FAILED"
}

/** A project row with storage links supplied by the caller. */
export const workbenchProjectOf = (
    row: StoredProject,
    workspaceId: string,
    render: MaybeWorkbenchRender,
): WorkbenchProject => ({
    id: row.id,
    title: row.title,
    goal: row.goal,
    aspect: row.aspect,
    targetSeconds: row.target_seconds,
    status: row.status,
    inputs: videoInputsOf(row.inputs, workspaceId),
    script: editorScenesOf(row.script, workspaceId),
    version: row.version,
    scriptMs: row.script_ms,
    lastErrorCode: lastErrorCodeOf(row.last_error),
    render,
    renderCount: row.render_ids.length,
    approvedAt: row.approved_at === null ? null : videoInstant(row.approved_at),
    approvedByName: row.approved_by_name,
    publishedAt: row.published_at === null ? null : videoInstant(row.published_at),
    createdAt: videoInstant(row.created_at),
    updatedAt: videoInstant(row.updated_at),
})
