import type { ContentChannel } from "./content"

/** A message a content surface shows after a command: its tone and its words. */
export interface ContentNoteView {
    readonly tone: "ok" | "error"
    readonly text: string
}

/** Where a post stands in its life. */
export type ContentStatusView = "idea" | "draft" | "waiting_approval" | "approved" | "published" | "skipped"

/** A status change the post editor offers. */
export type ContentTransitionView = "skip" | "restore" | "reopen" | "delete"

/** The facts of the open post the editor draws around its form. */
export interface ContentEditorItemView {
    readonly title: string
    readonly status: ContentStatusView
    readonly approved_by: string | null
    readonly holiday_key: string | null
}

/** The detail fields of the post editor form as the editor draws them. */
export interface ContentEditorFormView {
    readonly title: string
    readonly brief: string
    readonly pillarId: string | null
    readonly channels: ReadonlyArray<ContentChannel>
    readonly date: string
    readonly time: string
}

/** A change of the detail fields the editor sends up. */
export interface ContentEditorPatch {
    readonly title?: string
    readonly brief?: string
    readonly pillarId?: string | null
    readonly date?: string
    readonly time?: string
}
