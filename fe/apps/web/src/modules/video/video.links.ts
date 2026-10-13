import type { ProjectStatus } from "./video.types"

/** The steps of the video wizard, in order. The step lives in the address (the `tab` of the workbench). */
export type EditorStep = "goal" | "inputs" | "script" | "preview" | "result"

/** Where an existing project continues: what is next to do with it. */
export const stepFor = (status: ProjectStatus, scenes: number): EditorStep => {
    if (status === "ready" || status === "approved" || status === "published") return "result"
    if (status === "rendering") return "preview"
    return status === "scripting" || scenes > 0 ? "script" : "inputs"
}

/** The address of one step of one video ("new" opens the wizard on a project that does not exist yet). */
export const editorHref = (focus: string, step: EditorStep): string =>
    `?${new URLSearchParams({ focus, tab: step }).toString()}`
