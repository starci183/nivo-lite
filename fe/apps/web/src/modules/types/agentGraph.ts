/** The four kinds of node, the four bands of the screen from left to right: what starts the work, what is done, the condition that picks a branch, what comes out. */
export type AgentGraphNodeKind = "trigger" | "execute" | "condition" | "output"

/** Who works a node: the model only ever works an `understand` node. */
export type AgentGraphDoneBy = "agent" | "nivo" | "person"

/** What a branch does: run alone, ask the approver, or stop. */
export type AgentGraphThen = "auto" | "ask" | "stop"

/** What happens when nobody answers in time; `unset` is a draft that is not finished and cannot be published. */
export type AgentGraphOnTimeout = "backup" | "stop" | "agent_owner" | "unset"

/** The kind of rule behind a node or a branch. */
export type AgentGraphSourceKind = "brain" | "template" | "chat" | "learned" | "owner" | "rule" | "corrected"

/** The tone of a card on the graph. */
export type AgentGraphTone = "neutral" | "accent" | "success" | "warning" | "danger" | "muted"

/** The outline of a card on the graph. */
export type AgentGraphShape = "rect" | "round" | "diamond" | "stadium"

/** The areas and row tracks of the Setup grid on a phone and on a laptop, for the tab and the view in use. */
export interface AgentGraphLayoutView {
    readonly phoneAreas: ReadonlyArray<string>
    readonly phoneRows: ReadonlyArray<"auto" | "fill">
    readonly mediumAreas: ReadonlyArray<string>
    readonly mediumRows: ReadonlyArray<"auto" | "fill">
}

/** The tabs of the pane beside the graph. */
export type AgentGraphSideTab = "chat" | "detail" | "proposals" | "versions"

/** The four views the phone offers in place of two panes. */
export type AgentGraphPhoneView = "branches" | "graph" | "chat" | "proposals"

/** One line of a list answer: the owner's words and, under them, the technical name. */
export interface AgentGraphLine {
    readonly label: string
    readonly note: string
}

/** The rule behind a node or a branch, as a quote and the place it was said or written. */
export interface AgentGraphSourceData {
    readonly kind: AgentGraphSourceKind
    readonly quote: string
    readonly place: string
}

/** Who is asked, how long they have and who takes over, every name resolved by the back end from the workspace. */
export interface AgentGraphApproverData {
    readonly memberId: string
    readonly name: string
    /** "Can approve up to 20,000,000", in the owner's words. */
    readonly coverage: string
    readonly timeoutMinutes: number
    readonly onTimeout: AgentGraphOnTimeout
    readonly backupId: string
    readonly backupName: string
}

/** One branch of a decide point: the sentence of its condition, its bounds and what it does. */
export interface AgentGraphBranchData {
    readonly key: string
    /** "5 to under 20 million", written by the back end in the language of the reader. */
    readonly when: string
    /** The inclusive lower bound of the amount; null when the branch has none. */
    readonly fromVnd: number | null
    /** The exclusive upper bound of the amount; null when the branch has none. */
    readonly toVnd: number | null
    readonly then: AgentGraphThen
    /** The node the branch goes to. */
    readonly next: string
    readonly approver: AgentGraphApproverData | null
    readonly sources: ReadonlyArray<AgentGraphSourceData>
    readonly selfCorrected: boolean
}

/** What a node looks like at a glance. */
export interface AgentGraphCardData {
    /** At most 36 characters: "SePay · Dinh approves". */
    readonly description: string
    readonly tone: AgentGraphTone
    readonly shape: AgentGraphShape
    /** The word of the rule behind it: Brain, Template, Chat, Learned, Self-corrected. */
    readonly count: string
    readonly isPlaceholder: boolean
}

/** One node with its seven answers, none of them blank: "None" is an answer. */
export interface AgentGraphNodeData {
    readonly key: string
    readonly kind: AgentGraphNodeKind
    readonly title: string
    readonly doneBy: AgentGraphDoneBy
    readonly card: AgentGraphCardData
    readonly knows: ReadonlyArray<AgentGraphLine>
    readonly does: string
    readonly uses: ReadonlyArray<AgentGraphLine>
    readonly reads: ReadonlyArray<AgentGraphLine>
    readonly writes: ReadonlyArray<AgentGraphLine>
    readonly approver: AgentGraphApproverData | null
    readonly sources: ReadonlyArray<AgentGraphSourceData>
    /** The nodes that follow; a decide node names its followers in its branches. */
    readonly next: ReadonlyArray<string>
    /** What a decide node asks, "Real amount?"; empty on the other kinds. */
    readonly intent: string
    readonly branches: ReadonlyArray<AgentGraphBranchData>
}

/** One saved version of the graph as the owner lists it. */
export interface AgentGraphVersionData {
    readonly id: string
    readonly version: number
    readonly note: string
    /** "Chat, 28/10 09:12", already in the words of the reader. */
    readonly byLine: string
    readonly runs: number
    readonly isActive: boolean
}

/** One decision the learning proposes on, with what each did. */
export interface AgentGraphEvidenceData {
    readonly id: string
    readonly line: string
    readonly outcome: string
}

/** What a proposal is about. */
export type AgentGraphProposalKind = "conflict" | "learned" | "template_update"

/** A thing NIVO proposes: a Brain conflict, a learned change or a template update. */
export interface AgentGraphProposalData {
    readonly id: string
    readonly kind: AgentGraphProposalKind
    readonly title: string
    readonly why: string
    /** More reach for the agent: only the owner may add it to the draft. */
    readonly widens: boolean
    readonly nodeKey: string
    readonly branchKey: string
    readonly evidence: ReadonlyArray<AgentGraphEvidenceData>
    /** What the map follows now, for a conflict. */
    readonly before: AgentGraphSourceData | null
    /** What the Brain says now, for a conflict. */
    readonly after: AgentGraphSourceData | null
    /** What would change if the owner chose it, one sentence each. */
    readonly effects: ReadonlyArray<string>
    /** The confirm button of a conflict reads the new value, "Switch to 3 million". */
    readonly confirmLabel: string
    readonly keepLabel: string
    /** The amount the lower branch ends at and the next one starts at once the proposal is in the draft; null changes no bound. */
    readonly boundaryVnd: number | null
}

/** One step of a traced run. */
export interface AgentGraphRunStepData {
    readonly id: string
    readonly time: string
    readonly text: string
    readonly note: string
}

/** One run traced on the version that decided it. */
export interface AgentGraphRunData {
    readonly id: string
    readonly title: string
    readonly summary: string
    readonly outcome: string
    /** "The model proposed 4.9M, the books say 7.2M. NIVO follows the books.", or empty. */
    readonly mismatch: string
    readonly steps: ReadonlyArray<AgentGraphRunStepData>
    /** The node keys on the path, in order. */
    readonly path: ReadonlyArray<string>
    /** The node that did not run and why. */
    readonly skipped: string
}

/** A person who may be asked, and the top of the amount they may approve. */
export interface AgentGraphMemberData {
    readonly id: string
    readonly name: string
    /** Null when the right has no top. */
    readonly upToVnd: number | null
}

/** One problem the checks found in the draft. */
export interface AgentGraphProblemData {
    readonly code: string
    readonly nodeKey: string
    readonly text: string
}

/** The graph of one agent as the editor opens it. */
export interface AgentGraphData {
    readonly mode: "shadow" | "enforced"
    readonly activeVersion: number
    readonly changes: number
    readonly gaps: number
    readonly problems: ReadonlyArray<AgentGraphProblemData>
    readonly nodes: ReadonlyArray<AgentGraphNodeData>
    readonly versions: ReadonlyArray<AgentGraphVersionData>
    readonly proposals: ReadonlyArray<AgentGraphProposalData>
    readonly runs: ReadonlyArray<AgentGraphRunData>
    readonly members: ReadonlyArray<AgentGraphMemberData>
}

/** The form of one branch while the owner edits it. */
export interface AgentGraphBranchForm {
    readonly fromVnd: number
    readonly toVnd: number
    readonly then: AgentGraphThen
    readonly approverId: string
    readonly timeoutHours: number
    readonly onTimeout: AgentGraphOnTimeout
    readonly backupId: string
}

/** What a draft change did, for the box "Will change" of the form. */
export interface AgentGraphChangeLine {
    readonly kind: "bounds" | "then" | "approver" | "timeout"
    readonly before: string
    readonly after: string
}

/** A node as the graph draws it at a glance, in the shape the graph component takes. */
export interface AgentGraphFlowNode {
    readonly id: string
    readonly label: string
    readonly description: string
    readonly tone: AgentGraphTone
    readonly shape: AgentGraphShape
    readonly count: string
    readonly isPlaceholder: boolean
    /** Where the card sits, in graph units: its band is the column, its order in the band the row. */
    readonly position: { readonly x: number; readonly y: number }
}

/** An edge of the graph; a branch of a decide node reads its condition on the edge. */
export interface AgentGraphFlowEdge {
    readonly id: string
    readonly source: string
    readonly target: string
    readonly label?: string
}

/** What paints the graph: the selected node, or the path of a traced run. */
export interface AgentGraphPaint {
    readonly selectedKey: string
    readonly path: ReadonlyArray<string>
}

/** The branch a node is the answer of, with the decide node that asks. */
export interface AgentGraphBranchHit {
    readonly parent: AgentGraphNodeData
    readonly branch: AgentGraphBranchData
    readonly position: number
}

/** How the right of an approver reads against the top of a branch. */
export type AgentGraphRight = "none" | "missing" | "covers" | "short"

/** The words a change to the draft needs, written by the hook in the language of the reader. */
export interface AgentGraphWords {
    readonly when: (fromVnd: number | null, toVnd: number | null) => string
}

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
    readonly trace: () => void
    readonly untrace: () => void
}

/** What a person does on the graph panes, as one action with atoms: the block hands every command through it. */
export type AgentGraphAction =
    | { readonly kind: "select" | "sideTab" | "phoneView" | "openNode" | "restore"; readonly value: string }
    | { readonly kind: "field"; readonly name: keyof AgentGraphBranchForm; readonly value: string | number }
    | { readonly kind: "decide"; readonly value: string; readonly isConfirmed: boolean }
    | { readonly kind: "closeDrawer" | "edit" | "save" | "cancel" | "publish" | "trace" | "untrace" }
