import type { ApprovalPolicy, ApproverGroup } from "@modules/domain/authority-rules"
import type { DataRight } from "@modules/domain/mcp-gateway"

/** The most nodes one graph may hold. */
export const MAX_GRAPH_NODES = 60

/** The deepest an `all` or `any` may nest, and the most terms one condition may hold. */
export const MAX_CONDITION_DEPTH = 2
export const MAX_CONDITION_TERMS = 6

/** The longest a node title and a node's sentence may be. */
export const MAX_TITLE_LENGTH = 28
export const MAX_DOES_LENGTH = 200

/** The approved unedited decisions in a row on one branch before a boundary rises (section 15.8). */
export const TRUST_THRESHOLD = 20

/** The fact a decision keeps beside the amount the records hold: the amount the model wrote, when the two differ. */
export const MODEL_AMOUNT_FACT = "model.amount_vnd"

/** A decision after which the agent is judged by its graph: shadow only records, enforced decides. */
export type GraphMode = "shadow" | "enforced"

/** The four kinds of node: what starts a flow, what the backend decides, what the flow works out, and what it finally does. */
export type GraphNodeKind = "trigger" | "condition" | "execute" | "output"

/** What starts a flow: a customer message, a tag of the agent in Office, an internal event or a schedule. */
export type TriggerStep = "customer_message" | "tag" | "event" | "schedule"

/** What the backend decides: it evaluates a safe condition and its out-edges are the branches. The model never does. */
export type ConditionStep = "evaluate"

/** What a flow works out: reading context, or calling the model or a tool through NIVO MCP. */
export type ExecuteStep = "read_context" | "call"

/** What a flow finally does: a reply, a wait for approval, a write of data, or nothing more. */
export type OutputStep = "reply" | "approval" | "write" | "stop"

/** The step of a node, within its kind. */
export type GraphNodeStep = TriggerStep | ConditionStep | ExecuteStep | OutputStep

/** The steps each kind may take. */
export const STEPS_OF_KIND: Readonly<Record<GraphNodeKind, ReadonlyArray<GraphNodeStep>>> = {
    trigger: ["customer_message", "tag", "event", "schedule"],
    condition: ["evaluate"],
    execute: ["read_context", "call"],
    output: ["reply", "approval", "write", "stop"],
}

/** The kind a step belongs to. */
export const kindOfStep = (step: GraphNodeStep): GraphNodeKind => {
    if (STEPS_OF_KIND.trigger.includes(step)) return "trigger"
    if (STEPS_OF_KIND.condition.includes(step)) return "condition"
    return STEPS_OF_KIND.execute.includes(step) ? "execute" : "output"
}

/** Who works a node: the model only ever works a `call` step. */
export type GraphDoneBy = "agent" | "nivo" | "person"

/** The answers of a node a person may mark as "None" on purpose. */
export type NodeAnswerKey = "knows" | "uses" | "reads" | "writes" | "sources"

/** One thing a node reads or knows. */
export interface KnownItem {
    /** The kind. */
    readonly kind: "brain_fact" | "brain_passage" | "dossier" | "lesson" | "record"
    /** The ref. */
    readonly ref: string
    /** The label. */
    readonly label: string
}

/** One provider tool a node uses. */
export interface ToolUse {
    /** The provider. */
    readonly provider: "brain" | "drive" | "sepay" | "zalo" | "telegram" | "office" | "mcp"
    /** The tool. */
    readonly tool: string | null
    /** The scope. */
    readonly scope: "read" | "write"
    /** The label. */
    readonly label: string
    /** True when the tool does not exist yet: drawn as a placeholder and never published as live. */
    readonly placeholder?: boolean | undefined
}

/** One piece of data a node reads or writes, in the owner's words. */
export interface DataUse {
    /** The fact. */
    readonly fact: string
    /** The label. */
    readonly label: string
    /** The place. */
    readonly place: string
}

/** A value a fact can hold. */
export type FactValue = number | string | boolean

/** A closed condition tree: nothing else parses. */
export type Condition =
    | { readonly all: ReadonlyArray<Condition> }
    | { readonly any: ReadonlyArray<Condition> }
    | {
          readonly fact: string
          readonly op: "lt" | "lte" | "gt" | "gte" | "eq" | "neq"
          readonly value: FactValue
      }
    | { readonly fact: string; readonly op: "in"; readonly value: ReadonlyArray<string> }
    | { readonly fact: string; readonly op: "known" }

/** What a branch does: run alone, ask the approver, or stop. */
export type BranchAction = "auto" | "ask" | "stop"

/** What happens when nobody answers in time; `unset` is a draft that is not finished and cannot be published. */
export type TimeoutAction =
    | { readonly kind: "backup"; readonly group: ApproverGroup }
    | { readonly kind: "stop" }
    | { readonly kind: "agent_owner" }
    | { readonly kind: "unset" }

/** Who is asked, how, and for how long. */
export interface BranchApprover {
    /** The group. */
    readonly group: ApproverGroup
    /** The policy. */
    readonly policy: ApprovalPolicy
    /** The timeout minutes. */
    readonly timeoutMinutes: number
    /** The on timeout. */
    readonly onTimeout: TimeoutAction
}

/** The rule behind a node or a branch. */
export type GraphSource =
    | { readonly kind: "brain"; readonly factId: string; readonly passage: string; readonly valueHash: string }
    | { readonly kind: "template"; readonly key: string; readonly version: number }
    | { readonly kind: "chat"; readonly messageId: string; readonly quote: string }
    | { readonly kind: "learned"; readonly proposalId: string }
    | { readonly kind: "owner"; readonly memberId: string }
    | { readonly kind: "rule"; readonly action: string }

/** One branch of a decide point; the first match wins and the last is the `else`. */
export interface GraphBranch {
    /** The key. */
    readonly key: string
    /** The when. */
    readonly when: Condition | "else"
    /** The then. */
    readonly then: BranchAction
    /** The next. */
    readonly next: string
    /** The approver. */
    readonly approver: BranchApprover | null
    /** The sources. */
    readonly sources: ReadonlyArray<GraphSource>
    /** True once the owner changed the branch by hand; the card then reads "Self-corrected". */
    readonly selfCorrected?: boolean | undefined
}

/** What a decide node decides: an intent, the facts it reads from real records and its branches. */
export interface DecidePoint {
    /** The intent. */
    readonly intent: string
    /** The facts. */
    readonly facts: ReadonlyArray<string>
    /** The branches. */
    readonly branches: ReadonlyArray<GraphBranch>
}

/** One node: the same seven answers for a shop owner. */
export interface GraphNode {
    /** Stable across versions; sources and traces name it. */
    readonly key: string
    /** What the node is: a trigger, a condition, an execute step or an output. */
    readonly kind: GraphNodeKind
    /** Which trigger, execute step or output it is, within its kind. */
    readonly step: GraphNodeStep
    /** Max 28 characters: what happens here, in the owner's words. */
    readonly title: string
    /** The done by. */
    readonly doneBy: GraphDoneBy
    /** The knows. */
    readonly knows: ReadonlyArray<KnownItem>
    /** Max 200 characters: the action in one sentence. */
    readonly does: string
    /** The uses. */
    readonly uses: ReadonlyArray<ToolUse>
    /** The reads. */
    readonly reads: ReadonlyArray<DataUse>
    /** The writes. */
    readonly writes: ReadonlyArray<DataUse>
    /** The approver. */
    readonly approver: BranchApprover | null
    /** The sources. */
    readonly sources: ReadonlyArray<GraphSource>
    /** The answers the owner marked "None" on purpose; an empty list that is not marked is a blank. */
    readonly none: ReadonlyArray<NodeAnswerKey>
    /** The nodes that follow; none on a `stop` and on a `decide`, whose branches name theirs. */
    readonly next: ReadonlyArray<string>
    /** The decide. */
    readonly decide?: DecidePoint | undefined
    /** On `act`: an authority action key. */
    readonly action?: string | undefined
    /** On `act`: a template key the engine runs. */
    readonly pipeline?: string | undefined
}

/** The whole graph of one agent. */
export interface GraphDocument {
    /** The nodes. */
    readonly nodes: ReadonlyArray<GraphNode>
    /** The rights. */
    readonly rights: ReadonlyArray<DataRight>
}

/** One thing a fact can be compared with: its type, unit and allowed values. */
export interface FactSpec {
    /** The key. */
    readonly key: string
    /** The type. */
    readonly type: "number" | "string" | "boolean"
    /** `vnd` makes the fact an amount the authority rules cap. */
    readonly unit: "vnd" | "percent" | "count" | null
    /** The allowed. */
    readonly allowed?: ReadonlyArray<string> | undefined
    /** The key of the catalog sentence that names the fact in the owner words. */
    readonly labelKey: string
}

/** The facts a graph may use, by key. */
export type FactRegistry = Readonly<Record<string, FactSpec>>

/** The facts as read from real records; a fact that could not be read is absent. */
export type FactValues = Readonly<Record<string, FactValue | undefined>>

/** What a node looks like at a glance in the graph: the shape of grammar's `FlowGraphNode`, without importing grammar. */
export interface GraphNodeCard {
    /** The id. */
    readonly id: string
    /** The label. */
    readonly label: string
    /** The description. */
    readonly description: string
    /** The tone. */
    readonly tone: "neutral" | "accent" | "success" | "warning" | "danger" | "muted"
    /** The shape. */
    readonly shape: "rect" | "round" | "diamond" | "stadium"
    /** Whether the node is a trigger, a condition, an execute step or an output. */
    readonly kind: GraphNodeKind
    /** Which trigger, execute step or output it is. */
    readonly step: GraphNodeStep
    /** The count. */
    readonly count: string
    /** The is placeholder. */
    readonly isPlaceholder: boolean
}

/** One finding of `graphProblems`. */
export interface GraphProblem {
    /** The code. */
    readonly code:
        | "cycle"
        | "no_trigger"
        | "not_from_trigger"
        | "bad_step"
        | "branch_no_output"
        | "dead_end"
        | "node_limit"
        | "no_else"
        | "else_auto"
        | "gap"
        | "overlap"
        | "ceiling"
        | "no_right"
        | "placeholder_live"
        | "approver_no_grant"
        | "blank_answer"
        | "on_timeout_unset"
        | "approver_missing"
        | "no_data_right"
        | "outsider_wide"
        | "bad_condition"
    /** The node key. */
    readonly nodeKey: string
    /** The branch key. */
    readonly branchKey: string | null
    /** The words a message needs to name what is wrong. */
    readonly detail: string
}

/** One thing the setup chat still has to ask, in the fixed order of section 15.6. */
export interface GraphGap {
    /** The code. */
    readonly code: "boundary" | "approver_missing" | "approver_absent" | "on_timeout" | "else_unset" | "approver_no_grant"
    /** The node key. */
    readonly nodeKey: string
    /** The branch key. */
    readonly branchKey: string | null
}

/** The ceiling the authority rules put on one action. */
export interface CeilingRule {
    /** The action. */
    readonly action: string
    /** The mode. */
    readonly mode: "auto" | "ask" | "never"
    /** Strictly below this the action runs alone, when the rule has no bands. */
    readonly limitVnd: number | null
    /** Up to this, inclusive, the action runs alone. */
    readonly autoMax: number | null
    /** The action never runs alone; the registry caps it at `ask` or `never`. */
    readonly maxMode: "ask" | "never" | null
}

/** What the pure checks need to know about the workspace. */
export interface GraphContext {
    /** The facts. */
    readonly facts: FactRegistry
    /** The ceilings. */
    readonly ceilings: ReadonlyArray<CeilingRule>
    /** Whether the agent holds a grant on the tool, by its `connector.tool` name or the connector wildcard. */
    readonly isGranted: (tool: string) => boolean
    /** Whether the member group may approve the action up to this amount (null: no top). */
    readonly approverCovers: (action: string, group: ApproverGroup, top: number | null) => boolean
    /** Whether the group still holds at least one active seat. */
    readonly groupHasPeople: (group: ApproverGroup) => boolean
    /** Whether the agent faces customers. */
    readonly facesCustomers: boolean
}

/** One decision the learning reads, newest last. */
export interface ClosedDecision {
    /** The id. */
    readonly id: string
    /** The branch key. */
    readonly branchKey: string
    /** The closed as. */
    readonly closedAs: "done" | "approved" | "edited" | "rejected" | "expired"
    /** The amount. */
    readonly amount: number | null
}

/** A thing the learning proposes, with the decisions that prove it. */
export interface LearnedProposal {
    /** The signal. */
    readonly signal: "trust" | "reject" | "timeout"
    /** The branch key. */
    readonly branchKey: string
    /** The dedupe key. */
    readonly dedupeKey: string
    /** The widens. */
    readonly widens: boolean
    /** The evidence. */
    readonly evidence: ReadonlyArray<string>
    /** The amounts the evidence decisions carried, which a confirmed proposal moves a boundary to. */
    readonly amounts: ReadonlyArray<number>
}

/** One reason a change widens what the agent may do. */
export interface DiffChange {
    /** The kind. */
    readonly kind: "boundary_raised" | "branch_more_auto" | "tool_added" | "self_approver" | "right_added" | "right_widened"
    /** The node key. */
    readonly nodeKey: string | null
    /** The branch key. */
    readonly branchKey: string | null
}

/** What a change did to the agent's reach. */
export interface GraphDiff {
    /** The widens. */
    readonly widens: boolean
    /** The changes. */
    readonly changes: ReadonlyArray<DiffChange>
}

/** How a version came to be. */
export type GraphChangeKind = "seed" | "chat" | "edit" | "conflict" | "learned" | "template" | "rollback"

/** Where a proposal stands: waiting for a person, taken, turned down, or overtaken by a newer change. */
export type ProposalStatus = "open" | "confirmed" | "declined" | "superseded"

/** The kinds of proposal. */
export type ProposalKind = "conflict" | "learned" | "template_update"

/** How a decision closed. */
export type DecisionClosedAs = "done" | "approved" | "edited" | "rejected" | "expired"

/** One version of a graph as the owner lists it. */
export interface GraphVersionView {
    /** The id. */
    readonly id: string
    /** The version. */
    readonly version: number
    /** The change kind. */
    readonly changeKind: GraphChangeKind
    /** The note. */
    readonly note: string
    /** The published at. */
    readonly publishedAt: string
    /** The published by. */
    readonly publishedBy: string | null
}

/** One proposal as the owner reads it. */
export interface GraphProposalView {
    /** The id. */
    readonly id: string
    /** The kind. */
    readonly kind: ProposalKind
    /** The status. */
    readonly status: ProposalStatus
    /** The node key. */
    readonly nodeKey: string | null
    /** The branch key. */
    readonly branchKey: string | null
    /** The widens. */
    readonly widens: boolean
    /** The evidence. */
    readonly evidence: ReadonlyArray<string>
    /** The created at. */
    readonly createdAt: string
}

/** The graph of one agent as the editor opens it. */
export interface AgentGraphView {
    /** The agent id. */
    readonly agentId: string
    /** The installation id. */
    readonly installationId: string
    /** The mode. */
    readonly mode: GraphMode
    /** The draft. */
    readonly draft: GraphDocument
    /** The draft rev. */
    readonly draftRev: number
    /** The active version id. */
    readonly activeVersionId: string | null
    /** The gaps. */
    readonly gaps: ReadonlyArray<GraphGap>
    /** The problems. */
    readonly problems: ReadonlyArray<GraphProblem>
    /** The nodes as the graph draws them at a glance. */
    readonly cards: ReadonlyArray<GraphNodeCard>
    /** The proposals still waiting for a person. */
    readonly proposals: ReadonlyArray<GraphProposalView>
}

/** Looks a sentence of the message catalog up in the language of the reader, so a policy stays pure and holds no wording. */
export type Say = (key: string, params?: Readonly<Record<string, string | number>>) => string
