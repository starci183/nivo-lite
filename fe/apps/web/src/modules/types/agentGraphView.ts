import type {
    AgentGraphBranchForm,
    AgentGraphLine,
    AgentGraphFlowEdge,
    AgentGraphFlowNode,
    AgentGraphEvidenceData,
    AgentGraphProposalKind,
    AgentGraphRunStepData,
    AgentGraphSourceData,
    AgentGraphPhoneView,
    AgentGraphSideTab,
} from "./agentGraph"

/** The tone of a badge or an alert in the panes. */
export type AgentGraphMark = "neutral" | "accent" | "success" | "warning" | "danger" | "muted"

/** A short mark: a word and its tone. */
export interface AgentGraphBadgeView {
    readonly text: string
    readonly tone: AgentGraphMark
}

/** The band over the graph: what it is, where it stands and the publish command. */
export interface AgentGraphHeadView {
    readonly title: string
    readonly status: string
    readonly badges: ReadonlyArray<AgentGraphBadgeView>
    readonly publishLabel: string
    /** Empty when the draft may be published; otherwise why it may not. */
    readonly publishBlocked: string
    readonly isPublishing: boolean
}

/** The graph itself: its name for assistive technology, the cards, the edges and the selected card. */
export interface AgentGraphCanvasView {
    readonly label: string
    readonly emptyLabel: string
    readonly nodes: ReadonlyArray<AgentGraphFlowNode>
    readonly edges: ReadonlyArray<AgentGraphFlowEdge>
    /** The title of each band, over its column. */
    readonly headers: ReadonlyArray<{ readonly label: string; readonly at: number }>
    readonly selectedId: string
}

/** One answer of the seven, in the shape that draws it. */
export type AgentGraphAnswerView =
    | { readonly id: string; readonly term: string; readonly kind: "text"; readonly text: string }
    | {
          readonly id: string
          readonly term: string
          readonly kind: "lines"
          readonly lines: ReadonlyArray<AgentGraphLine>
      }
    | {
          readonly id: string
          readonly term: string
          readonly kind: "approver"
          readonly name: string
          readonly coverage: string
          readonly timeout: string
      }
    | {
          readonly id: string
          readonly term: string
          readonly kind: "sources"
          readonly sources: ReadonlyArray<{
              readonly id: string
              readonly kindLabel: string
              readonly quote: string
              readonly place: string
          }>
      }

/** A node or a branch with its answers; a branch also says when it is taken. */
export interface AgentGraphDetailView {
    readonly title: string
    readonly badge: string
    readonly subtitle: string
    /** The problem found on this node, in the owner's words; empty when there is none. */
    readonly problemTitle: string
    readonly problem: string
    readonly answers: ReadonlyArray<AgentGraphAnswerView>
    /** Empty when the person may not edit or the node is not a branch. */
    readonly editLabel: string
    readonly runsLabel: string
}

/** One option of a select or a segmented control. */
export interface AgentGraphOptionView {
    readonly value: string
    readonly label: string
}

/** The form of one branch with the words of every field and the verdict on the approver's right. */
export interface AgentGraphEditorView {
    readonly title: string
    readonly hint: string
    readonly form: AgentGraphBranchForm
    readonly labels: {
        readonly from: string
        readonly to: string
        readonly then: string
        readonly approver: string
        readonly hours: string
        readonly onTimeout: string
        readonly backup: string
    }
    readonly thenOptions: ReadonlyArray<AgentGraphOptionView>
    readonly memberOptions: ReadonlyArray<AgentGraphOptionView>
    readonly timeoutOptions: ReadonlyArray<AgentGraphOptionView>
    /** The line under the approver: who it was before. */
    readonly approverHelp: string
    readonly rightTone: "none" | "covers" | "short"
    readonly rightText: string
    readonly changesTitle: string
    readonly changes: ReadonlyArray<string>
    readonly saveLabel: string
    readonly cancelLabel: string
    readonly isSavable: boolean
}

/** A traced run with its steps. */
export interface AgentGraphRunView {
    readonly title: string
    readonly outcome: string
    readonly summary: string
    readonly mismatch: string
    readonly stepsLabel: string
    readonly steps: ReadonlyArray<AgentGraphRunStepData>
    readonly skipped: string
    readonly backLabel: string
}

/** One proposal as the owner reads it, evidence included. */
export interface AgentGraphProposalView {
    readonly id: string
    readonly kind: AgentGraphProposalKind
    readonly kindLabel: string
    readonly widensLabel: string
    readonly widensTone: AgentGraphMark
    readonly title: string
    readonly why: string
    readonly beforeTitle: string
    readonly before: AgentGraphSourceData | null
    readonly afterTitle: string
    readonly after: AgentGraphSourceData | null
    readonly effectsTitle: string
    readonly effects: ReadonlyArray<string>
    readonly evidenceTitle: string
    readonly evidence: ReadonlyArray<AgentGraphEvidenceData>
    /** "See all 20", empty when every row already shows. */
    readonly evidenceMoreLabel: string
    readonly confirmLabel: string
    readonly keepLabel: string
    /** Empty when this person may add the proposal to the draft; otherwise why not. */
    readonly confirmBlocked: string
}

/** The proposals waiting for a person. */
export interface AgentGraphProposalsView {
    readonly title: string
    readonly hint: string
    readonly emptyText: string
    readonly items: ReadonlyArray<AgentGraphProposalView>
}

/** One version of the history. */
export interface AgentGraphVersionView {
    readonly id: string
    readonly title: string
    readonly badge: AgentGraphBadgeView | null
    readonly note: string
    readonly byLine: string
    readonly restoreLabel: string
    readonly canRestore: boolean
}

/** Whether the graph decides or only records, and who may switch it. */
export interface AgentGraphModeView {
    readonly title: string
    readonly label: string
    readonly hint: string
    readonly isEnforced: boolean
    readonly isDisabled: boolean
}

/** The history of the graph. */
export interface AgentGraphVersionsView {
    readonly mode: AgentGraphModeView
    readonly title: string
    readonly hint: string
    readonly items: ReadonlyArray<AgentGraphVersionView>
}

/** One branch as a sentence, for the phone. */
export interface AgentGraphBranchRowView {
    readonly id: string
    readonly nodeKey: string
    readonly when: string
    readonly title: string
    readonly line: string
    readonly source: string
    readonly openLabel: string
}

/** The phone list of branches. */
export interface AgentGraphBranchesView {
    readonly title: string
    readonly hint: string
    readonly rows: ReadonlyArray<AgentGraphBranchRowView>
}

/** Everything the graph panes draw once the graph is in, every word resolved. */
export interface AgentGraphPanelView {
    readonly head: AgentGraphHeadView
    readonly canvas: AgentGraphCanvasView
    readonly sideTab: AgentGraphSideTab
    readonly tabsLabel: string
    readonly tabs: ReadonlyArray<AgentGraphOptionView>
    readonly phoneView: AgentGraphPhoneView
    readonly phoneLabel: string
    readonly phoneOptions: ReadonlyArray<AgentGraphOptionView>
    readonly inspector: "detail" | "editor" | "run"
    readonly detail: AgentGraphDetailView
    readonly editor: AgentGraphEditorView | null
    readonly run: AgentGraphRunView | null
    readonly proposals: AgentGraphProposalsView
    readonly versions: AgentGraphVersionsView
    readonly branches: AgentGraphBranchesView
    readonly drawerTitle: string
    readonly isDrawerOpen: boolean
}

/** The commands of the graph panes; every argument is an atom. */
export interface AgentGraphCommands {
    readonly select: (nodeKey: string) => void
    readonly sideTab: (value: string) => void
    readonly phoneView: (value: string) => void
    readonly openNode: (nodeKey: string) => void
    readonly closeDrawer: () => void
    readonly edit: () => void
    readonly field: (name: keyof AgentGraphBranchForm, value: string | number) => void
    readonly save: () => void
    readonly cancel: () => void
    readonly publish: () => void
    readonly decide: (proposalId: string, isConfirmed: boolean) => void
    readonly restore: (versionId: string) => void
    readonly mode: (value: string) => void
    readonly trace: () => void
    readonly untrace: () => void
}

/** What a person does on the graph panes, as one action with atoms: the block hands every command through it. */
export type AgentGraphAction =
    | { readonly kind: "select" | "sideTab" | "phoneView" | "openNode" | "restore"; readonly value: string }
    | { readonly kind: "field"; readonly name: keyof AgentGraphBranchForm; readonly value: string | number }
    | { readonly kind: "mode"; readonly value: string }
    | { readonly kind: "decide"; readonly value: string; readonly isConfirmed: boolean }
    | { readonly kind: "closeDrawer" | "edit" | "save" | "cancel" | "publish" | "trace" | "untrace" }
