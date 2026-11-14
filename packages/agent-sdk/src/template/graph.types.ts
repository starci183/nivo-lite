/** The kinds of node: what starts a flow, what is decided, what is worked out, and what is finally done. */
export type NodeKind = "trigger" | "condition" | "execute" | "output"

/** The built-in steps of a node, within its kind. */
export type NodeStep =
    | "customer_message"
    | "tag"
    | "event"
    | "schedule"
    | "evaluate"
    | "read_context"
    | "call"
    | "reply"
    | "approval"
    | "write"
    | "stop"

/** Who works a node. */
export type NodeDoneBy = "agent" | "nivo" | "person"

/** The answers of a node a person may mark as none on purpose. */
export type NodeAnswerKey = "knows" | "uses" | "reads" | "writes" | "sources"

/** One thing a node knows. */
export interface NodeKnown {
    /** What it is. */
    readonly kind: "brain_fact" | "brain_passage" | "dossier" | "lesson" | "record"
    /** The reference. */
    readonly ref: string
    /** The label. */
    readonly label: string
}

/** One provider tool a node uses. */
export interface NodeToolUse {
    /** The provider. */
    readonly provider: string
    /** The tool. */
    readonly tool: string | null
    /** The scope. */
    readonly scope: "read" | "write"
    /** The label. */
    readonly label: string
    /** True when the tool does not exist yet. */
    readonly placeholder?: boolean | undefined
}

/** One piece of data a node reads or writes. */
export interface NodeDataUse {
    /** The fact. */
    readonly fact: string
    /** The label. */
    readonly label: string
    /** The place. */
    readonly place: string
}

/** A value a fact can hold. */
export type FactValue = number | string | boolean

/** A closed condition tree. */
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

/** The people an approval asks. */
export interface ApproverGroup {
    /** The roles. */
    readonly roles: ReadonlyArray<"owner" | "manager" | "staff">
    /** The rooms. */
    readonly rooms: ReadonlyArray<string>
    /** The members. */
    readonly members: ReadonlyArray<string>
}

/** What happens when nobody answers in time. */
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
    readonly policy: "any" | "all" | "sequential"
    /** The wait in minutes. */
    readonly timeoutMinutes: number
    /** What happens at the end of the wait. */
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

/** One branch of a decide point. */
export interface GraphBranch {
    /** The key. */
    readonly key: string
    /** The condition, or the else. */
    readonly when: Condition | "else"
    /** What it does: runs by itself, asks its approver first, or stops. */
    readonly mode: "auto" | "ask" | "stop"
    /** The next node. */
    readonly next: string
    /** The approver. */
    readonly approver: BranchApprover | null
    /** The sources. */
    readonly sources: ReadonlyArray<GraphSource>
    /** True once a person changed it by hand. */
    readonly selfCorrected?: boolean | undefined
}

/** What a decide node decides. */
export interface DecidePoint {
    /** The intent. */
    readonly intent: string
    /** The facts. */
    readonly facts: ReadonlyArray<string>
    /** The branches. */
    readonly branches: ReadonlyArray<GraphBranch>
}

/** The events a trigger node matches. */
export interface TriggerMatch {
    /** The event types. */
    readonly eventTypes: ReadonlyArray<string>
    /** The sources. */
    readonly sources: ReadonlyArray<string>
}

/** One node of a graph. */
export interface GraphNode {
    /** The key. */
    readonly key: string
    /** The kind. */
    readonly kind: NodeKind
    /** The step. */
    readonly step: NodeStep
    /** The title. */
    readonly title: string
    /** Who works it. */
    readonly doneBy: NodeDoneBy
    /** What it knows. */
    readonly knows: ReadonlyArray<NodeKnown>
    /** What it does. */
    readonly does: string
    /** The tools it uses. */
    readonly uses: ReadonlyArray<NodeToolUse>
    /** What it reads. */
    readonly reads: ReadonlyArray<NodeDataUse>
    /** What it writes. */
    readonly writes: ReadonlyArray<NodeDataUse>
    /** The approver. */
    readonly approver: BranchApprover | null
    /** The sources. */
    readonly sources: ReadonlyArray<GraphSource>
    /** The answers marked none. */
    readonly none: ReadonlyArray<NodeAnswerKey>
    /** The nodes that follow. */
    readonly next: ReadonlyArray<string>
    /** The decide point. */
    readonly decide?: DecidePoint | undefined
    /** The action. */
    readonly action?: string | undefined
    /** The pipeline. */
    readonly pipeline?: string | undefined
    /** The trigger. */
    readonly trigger?: TriggerMatch | undefined
    /** The hand-over. */
    readonly handoverTo?: string | undefined
    /** The trigger sources. */
    readonly triggerSources?: ReadonlyArray<string> | undefined
}

/** One limit of the business half of a contract. */
export interface ContractLimit {
    /** The text. */
    readonly text: string
    /** The triggers. */
    readonly triggers: ReadonlyArray<string>
    /** The trusts. */
    readonly trusts: ReadonlyArray<"outsider" | "member" | "manager" | "system">
    /** The sources. */
    readonly sources: ReadonlyArray<ContractSource>
}

/** Where a business value of a contract came from. */
export type ContractSource =
    | { readonly kind: "brain"; readonly factId: string; readonly passage: string; readonly valueHash: string }
    | { readonly kind: "chat"; readonly messageId: string; readonly quote: string }
    | { readonly kind: "owner"; readonly memberId: string }

/** The business half of one contract. */
export interface GraphContract {
    /** The intent. */
    readonly intent: string
    /** The task. */
    readonly task: string
    /** The limits. */
    readonly limits: ReadonlyArray<ContractLimit>
    /** The sources. */
    readonly sources: ReadonlyArray<ContractSource>
}

/** The whole graph of one agent. */
export interface GraphDocument {
    /** The nodes. */
    readonly nodes: ReadonlyArray<GraphNode>
    /** The business half of the contracts. */
    readonly contracts?: ReadonlyArray<GraphContract> | undefined
}
