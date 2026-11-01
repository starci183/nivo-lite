import type {
    AgentGraphFormChange,
    AgentGraphLine,
    AgentGraphFlowEdge,
    AgentGraphFlowNode,
    AgentGraphEvidenceData,
    AgentGraphProposalKind,
    AgentGraphRunStepData,
    AgentGraphSourceData,
    AgentGraphOp,
    AgentGraphOnTimeout,
    AgentGraphPhoneView,
    AgentGraphSideTab,
    AgentGraphThen,
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
    /** The problems found on this node, in the owner's words; empty when there are none. */
    readonly problemTitle: string
    readonly problems: ReadonlyArray<string>
    readonly answers: ReadonlyArray<AgentGraphAnswerView>
    /** Empty when the person may not edit or the node is not a branch. */
    readonly editLabel: string
    /** The decision point the edit opens: the node itself, or the one that asks the branch the node answers. */
    readonly editNodeKey: string
    readonly runsLabel: string
}

/** One option of a select or a segmented control. */
export interface AgentGraphOptionView {
    readonly value: string
    readonly label: string
}

/** One comparison of a branch, in the shape that draws it: a fact, how it is compared, and the one input its value needs. */
export interface AgentGraphTermView {
    /** What names the term among the terms of its row. */
    readonly id: string
    readonly fact: string
    readonly op: AgentGraphOp
    readonly amount: number
    readonly text: string
    /** Which input the value takes: a number, one of a few values, or free words; none when the comparison needs no value. */
    readonly input: "number" | "choice" | "text" | "none"
    readonly opOptions: ReadonlyArray<AgentGraphOptionView>
    /** The values of a fact that is one of a few, and yes or no for a fact that is a switch. */
    readonly valueOptions: ReadonlyArray<AgentGraphOptionView>
    /** "5 million", the amount read back in the owner's words under the number. */
    readonly amountWords: string
    readonly canRemove: boolean
}

/** One branch of the decision point as a row of the editor. */
export interface AgentGraphRowView {
    /** What names the row among the rows of the editor: its branch key, or a name for a branch not saved yet. */
    readonly id: string
    readonly index: number
    readonly title: string
    readonly isElse: boolean
    readonly isLocked: boolean
    /** The condition as a sentence, read back live as the owner edits. */
    readonly sentence: string
    readonly terms: ReadonlyArray<AgentGraphTermView>
    readonly canAddTerm: boolean
    readonly then: AgentGraphThen
    readonly approverId: string
    /** The people who may be asked; a row that keeps the group of roles it had offers that group first. */
    readonly approverOptions: ReadonlyArray<AgentGraphOptionView>
    readonly timeoutHours: number
    readonly onTimeout: AgentGraphOnTimeout
    readonly backupId: string
    readonly canMoveUp: boolean
    readonly canMoveDown: boolean
    readonly canRemove: boolean
    /** What is wrong with the row, at its field: the form's own checks and what the back end found when the draft was last saved. */
    readonly approverError: string
    readonly backupError: string
    readonly problems: ReadonlyArray<string>
}

/** The editor of one decision point: its branches as rows of conditions, never a text box. */
export interface AgentGraphDecideEditorView {
    readonly title: string
    readonly hint: string
    readonly rows: ReadonlyArray<AgentGraphRowView>
    readonly labels: {
        readonly fact: string
        readonly op: string
        readonly value: string
        readonly amount: string
        readonly then: string
        readonly approver: string
        readonly hours: string
        readonly onTimeout: string
        readonly backup: string
        readonly addTerm: string
        readonly removeTerm: string
        readonly moveUp: string
        readonly moveDown: string
        readonly removeRow: string
        readonly lockedNote: string
        readonly elseNote: string
        readonly allTerms: string
    }
    readonly factOptions: ReadonlyArray<AgentGraphOptionView>
    readonly thenOptions: ReadonlyArray<AgentGraphOptionView>
    /** Everyone who may take over, for the person who steps in after the wait. */
    readonly memberOptions: ReadonlyArray<AgentGraphOptionView>
    readonly timeoutOptions: ReadonlyArray<AgentGraphOptionView>
    readonly addRowLabel: string
    readonly canAddRow: boolean
    readonly saveLabel: string
    readonly cancelLabel: string
    /** Empty when the draft may take the form; otherwise why not. */
    readonly saveBlocked: string
}

/** The problems of the draft in the owner's words, with the step each one is about. */
export interface AgentGraphProblemsView {
    readonly title: string
    readonly items: ReadonlyArray<{
        readonly id: string
        readonly nodeKey: string
        readonly text: string
        readonly isGrant: boolean
    }>
    readonly openLabel: string
    readonly grantLabel: string
    /** "See the other 3", over the problems after the first. */
    readonly moreLabel: string
}

/** What the owner can add to a graph with no decision point: which action to guard, and on which fact. */
export interface AgentGraphAdderView {
    readonly title: string
    readonly hint: string
    readonly actionLabel: string
    readonly factLabel: string
    /** The action and the fact shown as picked. */
    readonly action: string
    readonly fact: string
    readonly actions: ReadonlyArray<AgentGraphOptionView>
    readonly facts: ReadonlyArray<AgentGraphOptionView>
    readonly addLabel: string
    /** Empty when a decision point may be added; otherwise why not (nothing to guard, no fact, may not edit). */
    readonly blocked: string
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
    /** The question asked before the choice is made, and what each choice does, so no proposal is settled by one stray click. */
    readonly confirmTitle: string
    readonly confirmBody: string
    readonly keepTitle: string
    readonly keepBody: string
    readonly cancelLabel: string
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
    /** What the list says when no branch is drawn. */
    readonly emptyLabel: string
    readonly rows: ReadonlyArray<AgentGraphBranchRowView>
}

/** Everything the graph panes draw once the graph is in, every word resolved. */
export interface AgentGraphPanelView {
    readonly head: AgentGraphHeadView
    /** The switch beside the map: does the agent work by the map or only record it. */
    readonly mode: AgentGraphModeView
    readonly canvas: AgentGraphCanvasView
    readonly sideTab: AgentGraphSideTab
    readonly tabsLabel: string
    readonly tabs: ReadonlyArray<AgentGraphOptionView>
    readonly phoneView: AgentGraphPhoneView
    readonly phoneLabel: string
    readonly phoneOptions: ReadonlyArray<AgentGraphOptionView>
    readonly inspector: "detail" | "editor" | "run"
    readonly detail: AgentGraphDetailView
    readonly editor: AgentGraphDecideEditorView | null
    readonly problems: AgentGraphProblemsView
    readonly adder: AgentGraphAdderView
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
    readonly edit: (nodeKey: string) => void
    readonly change: (change: AgentGraphFormChange) => void
    readonly pickAdder: (field: "action" | "fact", value: string) => void
    readonly addDecide: (action: string, fact: string) => void
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
    | { readonly kind: "edit"; readonly value: string }
    | { readonly kind: "form"; readonly change: AgentGraphFormChange }
    | { readonly kind: "adderPick"; readonly field: "action" | "fact"; readonly value: string }
    | { readonly kind: "addDecide"; readonly action: string; readonly fact: string }
    | { readonly kind: "mode"; readonly value: string }
    | { readonly kind: "decide"; readonly value: string; readonly isConfirmed: boolean }
    | { readonly kind: "closeDrawer" | "save" | "cancel" | "publish" | "trace" | "untrace" }
