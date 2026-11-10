import type { BadgeTone } from "@starci/grammar/common"
import type { BulkConfirmView } from "./brain-bulk"
import type { DataSlot } from "./slot"

/** How the marker of one step of a document's way into the brain reads. */
export type BrainDocStepState = "complete" | "current" | "upcoming" | "error" | "paused"

/** One step of the way a document takes: put in, read, split into facts, approved by the owner, used by the agents. */
export interface BrainDocStepView {
    readonly id: string
    readonly label: string
    /** What the step stands at: a date, a count or a word; empty when there is nothing to say. */
    readonly description: string
    readonly state: BrainDocStepState
}

/** One row of the documents table: the name with its kind, the facts it gave, where it stands and when it changed. */
export interface BrainDocRowView {
    readonly id: string
    readonly title: string
    readonly kind: string
    /** The facts waiting for the owner, in words; null when none. */
    readonly proposed: string | null
    /** The facts the owner approved, in words; null when none. */
    readonly approved: string | null
    readonly status: string
    readonly statusTone: BadgeTone
    readonly updated: string
}

/** One fact a document gave, as the drawer lists it. */
export interface BrainDocFactView {
    readonly id: string
    readonly title: string
    readonly value: string
    /** The first words of the document where it says so; null when it has none. */
    readonly quote: string | null
    readonly state: string
    readonly stateTone: BadgeTone
    readonly trust: string
    readonly trustTone: BadgeTone
}

/** The drawer of one document: where it stands, its facts and the one command that approves the safe ones. */
export interface BrainDocDrawerView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly steps: ReadonlyArray<BrainDocStepView>
    readonly currentStepId: string
    readonly factsTitle: string
    readonly factCount: number
    readonly facts: ReadonlyArray<BrainDocFactView>
    /** Approve together: its words and whether the write runs; null when the viewer may not write or nothing is safe to approve. */
    readonly approve: { readonly label: string; readonly isPending: boolean } | null
    /** The facts the approval leaves for a person, in words; null when none. */
    readonly leftOver: string | null
}

/** The words of the documents tab that do not depend on a row. */
export interface BrainDocsCopy {
    readonly tableLabel: string
    readonly columns: {
        readonly name: string
        readonly facts: string
        readonly status: string
        readonly updated: string
    }
    readonly noFacts: string
    readonly emptyBody: string
    readonly emptyAction: string
    readonly errorBody: string
    readonly stepsLabel: string
    readonly factsEmpty: string
    readonly close: string
}

/** What the documents tab draws: its rows as a slot, the opened document and the question asked before approving. */
export interface BrainDocsView {
    readonly slot: DataSlot<ReadonlyArray<BrainDocRowView>>
    readonly placeholder: ReadonlyArray<BrainDocRowView>
    readonly drawer: BrainDocDrawerView | null
    readonly confirm: BulkConfirmView | null
    readonly canAdd: boolean
}
