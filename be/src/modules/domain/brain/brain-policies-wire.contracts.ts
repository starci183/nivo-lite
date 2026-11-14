import type { PolicyAudience, PolicyProposalView, PolicySource, PolicyValueView } from "./brain-policies.contracts"

/** A policy parameter in the flat shape the Policies tab reads: every field of a parameter, null but those its type carries. */
export interface BrainPolicyParameterWire {
    /** The control: `money`, `percent`, `duration`, `time_range`, `boolean` or `text`. */
    type: string
    /** Money: the amount in VND. */
    amountVnd: number | null
    /** Money: what the amount is per. */
    per: string | null
    /** Percent: the percentage. */
    percent: number | null
    /** Duration: minutes. */
    minutes: number | null
    /** Time range: the start. */
    from: string | null
    /** Time range: the end. */
    to: string | null
    /** Boolean: the answer. */
    yes: boolean | null
    /** Text: the words. */
    text: string | null
}

/** The audience of a value, with a copy of its module list. */
export interface BrainPolicyAudienceWire extends Omit<PolicyAudience, "modules"> {
    /** The modules the value is for. */
    modules: Array<string>
}

/** One value of a policy (in force, scheduled, waiting or past) with its parameter flattened. */
export interface BrainPolicyValueWire extends Omit<PolicyValueView, "audience" | "parameter" | "source"> {
    /** The parameter, flat. */
    parameter: BrainPolicyParameterWire
    /** Where the value came from. */
    source: PolicySource
    /** Who the value is for. */
    audience: BrainPolicyAudienceWire
}

/** A waiting proposal. */
export interface BrainPolicyProposalWire extends BrainPolicyValueWire {
    /** What the proposal asks. */
    kind: PolicyProposalView["kind"]
    /** Who proposed it. */
    proposedBy: string
    /** When (ISO). */
    proposedAt: string
    /** The flags raised on it. */
    flags: Array<string>
    /** `choose` or `apply`. */
    useAction: PolicyProposalView["useAction"]
}

/** One row of the tab. */
export interface BrainPolicyRowWire {
    /** The row's fact id. */
    factId: string
    /** The subject key. */
    subjectKey: string
    /** The attribute key. */
    attribute: string
    /** The subject as people write it. */
    subjectLabel: string
    /** The row's name. */
    attributeLabel: string
    /** The control. */
    type: string
    /** The value in force. */
    current: BrainPolicyValueWire | null
    /** The value approved for a later start. */
    scheduled: BrainPolicyValueWire | null
    /** Proposals waiting for this truth. */
    pendingCount: number
    /** The waiting values. */
    pendingValues: Array<string>
    /** The derived policy id. */
    policyId: string | null
    /** The derived title. */
    title: string | null
    /** The derived reason. */
    reason: string | null
}

/** The rows of one subject. */
interface BrainPolicyGroupWire {
    /** The subject key. */
    subjectKey: string
    /** The subject as people write it. */
    subjectLabel: string
    /** The rows of the subject. */
    rows: Array<BrainPolicyRowWire>
}

/** A customer question no truth answered. */
interface BrainPolicyMissingWire {
    /** The gap's id. */
    gapId: string
    /** The module the question came through. */
    module: string
    /** The question. */
    question: string
    /** The topic, when one was named. */
    topic: string | null
    /** The attribute the question most likely asks for. */
    attributeGuess: string | null
    /** How many times it was asked. */
    count: number
    /** When it was last asked (ISO). */
    lastSeenAt: string
}

/** Where the AI-derived layer stands. */
interface BrainPolicyDerivationWire {
    /** The state of the derivation. */
    state: string
    /** Facts not yet derived. */
    pendingFacts: number
    /** When the layer was last derived (ISO). */
    derivedAt: string | null
    /** The last error. */
    error: string | null
}

/** The tab. */
export interface BrainPoliciesWire {
    /** The groups, by subject. */
    groups: Array<BrainPolicyGroupWire>
    /** Proposals waiting across every row. */
    pendingTotal: number
    /** True for the workspace owner. */
    canEdit: boolean
    /** Open customer questions no truth answered. */
    missing: Array<BrainPolicyMissingWire>
    /** Where the AI-derived layer stands. */
    derivation: BrainPolicyDerivationWire
}

/** The drawer of one row. */
export interface BrainPolicyDetailWire {
    /** The row. */
    row: BrainPolicyRowWire
    /** Waiting proposals. */
    proposals: Array<BrainPolicyProposalWire>
    /** Every value that was or is in force. */
    history: Array<BrainPolicyValueWire>
    /** True for the workspace owner. */
    canEdit: boolean
}
