import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { Locale } from "@modules/platform/i18n"
import type { ActiveWorkflowGraph, TemplateLink, WorkflowAuthor, WorkflowView } from "./agent-workflows.contracts"
import type { RightEntry, RightsSettlement } from "./policies/node-rights-gate.policy"

/** One operation a node of a version asks to call on an account, as its graph states it (the account null while a template leaves it unbound). */
export interface NodeRightAsk {
    /** The key of the node. */
    readonly nodeKey: string
    /** The kind of the account. */
    readonly kind: string
    /** The provider of the account, or null for any provider of the kind. */
    readonly provider: string | null
    /** The connected account, or null while it is not bound. */
    readonly connectionId: string | null
    /** The operation, by tool id. */
    readonly operation: string
    /** The mode asked. */
    readonly mode: "auto" | "ask"
}

/** How what the nodes of two graphs ask for on accounts differs; only nodes that state their accounts on both sides (or exist on one) are compared. */
export interface NodeRightsDiff {
    /** Asked by `after` and not by `before`. */
    readonly added: ReadonlyArray<NodeRightAsk>
    /** Asked by `before` and not by `after`. */
    readonly removed: ReadonlyArray<NodeRightAsk>
    /** Asked on `ask` by `before` and on `auto` by `after`. */
    readonly loosened: ReadonlyArray<NodeRightAsk>
}

/** The title of a step in the owner's two languages, as the installed node the step runs declares it. */
export interface StepTitle {
    /** Vietnamese. */
    readonly vi: string
    /** English. */
    readonly en: string
}

/** The title of a step, or null for a step no installed node is. */
export type OptionalStepTitle = StepTitle | null

/** A running workflow graph with the names a rights roll-up shows it by. */
export interface NamedWorkflowGraph extends ActiveWorkflowGraph {
    /** The key of the workflow within its agent. */
    readonly workflowKey: string
    /** The name of the workflow. */
    readonly workflowName: string
    /** The number of the version that runs: the version whose nodes ask. */
    readonly versionNumber: number
}

/** One operation a running node asks for on a connected account, and whether its workflow holds the grant row for it. */
export interface StandingRight extends RightEntry {
    /** True when the workflow holds a grant row for the entry; false while it waits for the owner. */
    readonly granted: boolean
    /** The mode the running version asks for; `auto` where `mode` is `ask` means the owner has not agreed to `auto`. */
    readonly asked: "auto" | "ask"
}

/** A running workflow with what its nodes ask for on its agent's connected accounts. */
export interface WorkflowRightsStanding extends NamedWorkflowGraph {
    /** The entries, in node, account and operation order. */
    readonly entries: ReadonlyArray<StandingRight>
}

/** What the first version of a new workflow is made of. */
export interface FirstVersion {
    /** The agent. */
    readonly agentId: string
    /** The key of the new workflow. */
    readonly key: string
    /** Its name. */
    readonly name: string
    /** The template it comes from, or null for a blank one. */
    readonly link: TemplateLink | null
    /** Its graph. */
    readonly graph: GraphSpec
    /** Who makes it. */
    readonly author: WorkflowAuthor
    /** The language of the view answered. */
    readonly locale: Locale
    /** What the rights gate settled for the graph; absent in a world with no gate and for a blank workflow, which asks nothing. */
    readonly rights: RightsSettlement | undefined
}

/** A workflow just made, with the version it runs. */
export interface MadeWorkflow {
    /** The workflow. */
    readonly view: WorkflowView
    /** Its first version. */
    readonly versionId: string
}

/** One entry an old client still sends to the removed rights agreement (`agreeAgentNodeRights`): read and ignored. */
export interface AgentAgreedRight {
    /** The workflow the old entry named. */
    readonly workflowId: string
    /** The node of that workflow the old entry named. */
    readonly nodeKey: string
    /** The account the old entry named. */
    readonly connectionId: string
    /** The API operation the old entry named. */
    readonly operation: string
    /** The mode the old entry named for that operation. */
    readonly mode: string
}

/**
 * What the removed rights agreement answers (nivo-frame `rights`: no rights-upgrade gate): the node's declared mode decides
 * (`nodeRightsDecide` is always true) and nothing is ever agreed (`agreed` is always 0). The trigger picks on the same road still apply.
 */
export interface AgentRightsAgreed {
    /** Always true: the mode each node declares decides, nothing is agreed on top of it. */
    readonly nodeRightsDecide: boolean
    /** How many entries were agreed: always 0. */
    readonly agreed: number
}
