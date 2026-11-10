import type { PaneGridLayout } from "./panes"
import type { DataSlot, SlotLabels } from "./slot"

/** The tone of a status chip of a facts or lessons row. */
type BrainChipTone = "success" | "warning" | "neutral" | "accent" | "danger" | "info"

/** One chip: a short word and its tone. */
export interface BrainChipView {
    readonly label: string
    readonly tone: BrainChipTone
}

/** One underline filter tab of a list: its words and how many rows it holds. */
export interface BrainFilterView {
    readonly id: string
    readonly label: string
    readonly count?: number
}

/** The head band of the opened item: what it is, its chip and the one line under it. */
export interface BrainHeadView {
    readonly title: string
    readonly description: string
    readonly badge: BrainChipView
}

/** A term and its words, as a description list draws them. */
interface BrainTermView {
    readonly id: string
    readonly term: string
    readonly text: string
}

/** One command of the opened lesson. */
export interface LessonActionView {
    readonly id: string
    readonly label: string
    readonly intent: "neutral" | "alternative" | "dismiss" | "commit"
    readonly isPending: boolean
}

/** One correction the lesson stands on: the words of the owner's reply when they are known, and where and when. */
interface LessonEvidenceView {
    readonly id: string
    readonly text: string | undefined
    readonly byline: string
}

/** What the opened lesson draws under its head. */
export interface LessonDetailView {
    readonly terms: ReadonlyArray<BrainTermView>
    readonly evidenceTitle: string
    readonly evidence: ReadonlyArray<LessonEvidenceView>
    readonly actions: ReadonlyArray<LessonActionView>
    readonly footnote: string | null
}

/** One lesson of the list with the detail that opens beside it. */
export interface LessonEntryView {
    readonly id: string
    /** The status the filter tabs narrow by. */
    readonly filter: string
    readonly title: string
    readonly line: string
    readonly badge: BrainChipView
    readonly head: BrainHeadView
    readonly detail: LessonDetailView
}

/** The control that picks the agent the list is about, and the command that studies its corrections. */
interface LessonAgentView {
    readonly label: string
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly value: string
    readonly mineLabel: string
    readonly isMining: boolean
    /** Owners and managers only: the study command is hidden where the member may not write. */
    readonly canMine: boolean
}

/** The lesson drawer: the form that writes a lesson by hand. */
export interface LessonDrawerView {
    readonly props: {
        readonly isOpen: boolean
        readonly isPending: boolean
        readonly title: string
        readonly closeLabel: string
        readonly cancelLabel: string
        readonly saveLabel: string
        readonly agentLabel: string
        readonly agentOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly agentPlaceholder: string
        readonly agent: string
        readonly titleLabel: string
        readonly bodyLabel: string
        readonly whenLabel: string
        readonly lessonTitle: string
        readonly lessonBody: string
        readonly lessonWhen: string
    }
    readonly on: {
        readonly close: () => void
        readonly submit: () => void
        readonly setAgent: (value: string | null) => void
        readonly setTitle: (value: string) => void
        readonly setBody: (value: string) => void
        readonly setWhen: (value: string) => void
    }
}

/** What the lessons tab draws. */
export interface LessonsView {
    readonly slot: DataSlot<ReadonlyArray<LessonEntryView>>
    /** What the list and detail draw as geometry while the first read waits. */
    readonly placeholder: ReadonlyArray<LessonEntryView>
    readonly slotLabels: SlotLabels
    readonly isFiltered: boolean
    readonly filters: ReadonlyArray<BrainFilterView>
    readonly filter: string
    readonly selectedId: string | null
    readonly grid: PaneGridLayout
    readonly agent: LessonAgentView
    /** What the last study of the corrections found, in one line; null before any. */
    readonly notice: string | null
}
