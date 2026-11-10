import type { BadgeTone } from "@starci/grammar/common"
import type { StepsMapView } from "./workflowSteps"

/** Where a workflow stands. */
export type WorkflowStatus = "active" | "draft" | "paused"

/** How a step differs between two graphs. */
export type WorkflowMark = "added" | "removed" | "changed"

/** One workflow in the left pane. */
export interface WorkflowRowView {
    readonly id: string
    readonly name: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    /** "Version 3". */
    readonly versionLabel: string
    /** "from the template Reconcile v2", or the word for a workflow made from scratch. */
    readonly provenance: string
}

/** The head card of the open workflow. */
export interface WorkflowHeadView extends WorkflowRowView {
    readonly status: WorkflowStatus
    /** "Version 3 · 7 steps". */
    readonly facts: string
    /** The command that stops or starts it. */
    readonly toggleLabel: string
    readonly toggleTo: WorkflowStatus
    /** Whether the graph of the main workflow can be opened in the editor. */
    readonly canEditGraph: boolean
}

/** The notice that a newer template exists. */
export interface WorkflowNoticeView {
    readonly version: number
    readonly title: string
    readonly changelog: string
    readonly diffLine: string
}

/** One version of the history. */
export interface WorkflowVersionRowView {
    readonly number: number
    readonly title: string
    readonly description: string
    readonly isActive: boolean
    /** Who saved it, the words of its note and the date, apart, for the table of versions. */
    readonly author?: string
    readonly note?: string
    readonly date?: string
}

/** The open workflow as the main pane draws it. */
export interface WorkflowDetailView {
    readonly head: WorkflowHeadView
    readonly notice: WorkflowNoticeView | null
    readonly graphTitle: string
    readonly flow: StepsMapView
    readonly versions: ReadonlyArray<WorkflowVersionRowView>
}

/** One step of a diff. */
export interface WorkflowDiffStepView {
    readonly key: string
    readonly title: string
    readonly mark: WorkflowMark
    readonly markLabel: string
    readonly description: string
}

/** A diff as the drawer draws it. */
export interface WorkflowDiffView {
    readonly steps: ReadonlyArray<WorkflowDiffStepView>
    /** The other changes: what wakes the graph, the rights, the tools and the effects. */
    readonly lines: ReadonlyArray<string>
    /** The steps both sides changed, where the owner's side stays; empty when none. */
    readonly kept: string
    readonly flow: StepsMapView
}

/** One template in the list. */
export interface WorkflowTemplateRowView {
    readonly id: string
    readonly name: string
    readonly summary: string
    /** "v3 · 1,284 shops use it". */
    readonly meta: string
    /** The kind of agent it is for, short ("Sales"). */
    readonly role: string
    /** What starts it ("SePay", "Schedule", "Zalo OA or Facebook"); empty when unknown. */
    readonly source: string
    /** "Needs: SePay, Google", or empty. */
    readonly needs: string
    readonly latest: number
}

/** One version of a template with what it changed. */
export interface WorkflowTemplateVersionView {
    readonly version: number
    readonly title: string
    readonly changes: ReadonlyArray<string>
}

/** One template with its graph and its changelog. */
export interface WorkflowTemplateDetailView extends WorkflowTemplateRowView {
    readonly flow: StepsMapView
    readonly versions: ReadonlyArray<WorkflowTemplateVersionView>
}

/** The workflows of the left pane. */
export interface WorkflowListView {
    readonly rows: ReadonlyArray<WorkflowRowView>
}

/** The templates the maker offers. */
export interface WorkflowTemplatesView {
    readonly templates: ReadonlyArray<WorkflowTemplateRowView>
}

/** A diff with the title the drawer carries. */
export interface WorkflowDiffReadView {
    readonly title: string
    readonly view: WorkflowDiffView
}

/** What the diff drawer is open for: a version against the one before it, or the newer template against the workflow. */
export type WorkflowDrawerView = { readonly kind: "version"; readonly number: number } | { readonly kind: "template" } | null

/** The drawer that makes a workflow from a template: whether it is open, the one chosen and whether the command is under way. */
export interface WorkflowCreateView {
    readonly isOpen: boolean
    readonly selectedId: string
    readonly detail: WorkflowTemplateDetailView | null
    readonly isCreating: boolean
}
