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
    /** A changed step's settings before and after, as one line each; absent when no setting changed. */
    readonly change?: { readonly from: string; readonly to: string }
}

/** One right, tool or action a version gained or lost, in the owner's words. */
export interface WorkflowDiffGrantView {
    readonly key: string
    readonly title: string
    /** What kind of grant it is (a right, a tool, an action, or what starts the workflow). */
    readonly kindLabel: string
    readonly mark: WorkflowMark
    readonly markLabel: string
}

/** A version against the one before it, as its page draws it. */
export interface WorkflowDiffView {
    /** The words of a first version, which has no version before it to differ from; empty otherwise. When set, nothing is marked. */
    readonly first: string
    /** "+2 steps · -1 steps · 3 changed"; empty for a first version. */
    readonly summary: string
    readonly steps: ReadonlyArray<WorkflowDiffStepView>
    /** The rights, tools and actions gained or lost, and what wakes the graph when that changed. */
    readonly grants: ReadonlyArray<WorkflowDiffGrantView>
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

/** A diff with the title the page carries. */
export interface WorkflowDiffReadView {
    readonly title: string
    readonly view: WorkflowDiffView
}

/** The drawer that makes a workflow from a template: whether it is open, the one chosen and whether the command is under way. */
export interface WorkflowCreateView {
    readonly isOpen: boolean
    readonly selectedId: string
    readonly detail: WorkflowTemplateDetailView | null
    readonly isCreating: boolean
}
