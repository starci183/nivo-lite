import type { Brand, MediaItem, ProjectView, SourceChoice, Goal } from "./video.types"
import type { Aspect } from "./video.constants"
import type { EditorStep } from "./video.links"
/** Actual joined editor values; a new project remains null. */
export interface VideoEditorData {
    readonly canEdit: boolean
    readonly project: ProjectView | null
    readonly step: EditorStep
    readonly wizardKey: string
    readonly media: ReadonlyArray<MediaItem>
    readonly sources: ReadonlyArray<SourceChoice>
    readonly brand: Brand
    readonly goal: {
        readonly projectId: string | null
        readonly goal: Goal
        readonly aspect: Aspect
        readonly seconds: number
        readonly title: string
        readonly locked: boolean
    }
}
