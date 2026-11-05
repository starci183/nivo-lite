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

/** One value of the history of a fact: the value, then what happened to it and when. */
export interface FactHistoryView {
    readonly id: string
    readonly value: string
    readonly line: string
}

/** What the opened fact draws under its head. */
export interface FactDetailView {
    readonly valueLabel: string
    readonly value: string
    readonly terms: ReadonlyArray<BrainTermView>
    /** The command that stops using the fact, which asks first; null where the member may not write. */
    readonly retire: { readonly label: string; readonly isPending: boolean } | null
    /** The drawer of a new value; null where the member may not write. */
    readonly edit: { readonly label: string; readonly href: string } | null
    readonly historyTitle: string
    readonly history: ReadonlyArray<FactHistoryView>
}

/** One fact of the list with the detail that opens beside it. */
export interface FactEntryView {
    readonly id: string
    /** The subject type the filter tabs narrow by. */
    readonly filter: string
    readonly title: string
    readonly line: string
    readonly badge: BrainChipView
    readonly head: BrainHeadView
    readonly detail: FactDetailView
}

/** The question asked before a fact stops being used. */
interface FactRetireView {
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
}

/** The notice of something due (a scheduled value waits, a value ended): its words and the command that answers it. */
interface BrainMaintainView {
    readonly title: string
    readonly body: string
    readonly actionLabel: string
    readonly isPending: boolean
}

/** What the facts tab draws: the entries as one slot, the controls over it and the opened fact. */
export interface FactsView {
    readonly slot: DataSlot<ReadonlyArray<FactEntryView>>
    /** What the list and detail draw as geometry while the first read waits. */
    readonly placeholder: ReadonlyArray<FactEntryView>
    readonly slotLabels: SlotLabels
    /** Some facts exist but the filter and the search keep none. */
    readonly isFiltered: boolean
    readonly filters: ReadonlyArray<BrainFilterView>
    readonly filter: string
    readonly query: string
    readonly selectedId: string | null
    readonly grid: PaneGridLayout
    readonly maintain: BrainMaintainView | null
    /** Asked before the fact stops being used; null while no stop is waiting for the answer. */
    readonly retire: FactRetireView | null
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
