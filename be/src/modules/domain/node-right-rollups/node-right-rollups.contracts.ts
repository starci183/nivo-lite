/**
 * THE TWO ROLL-UPS of what nodes call, both read-only information derived from the node tools (a right is an attachment plus a node's
 * declared mode: nothing is ticked): what an agent's workflow nodes call on the accounts the agent is attached to (the agent's page),
 * and, for one connected account's provider, which agent, workflow and step calls each operation and in which mode (the provider's
 * read-only permissions tab).
 */

/** Who asks: a member of the workspace. */
export interface RollupActor {
    /** The signed-in person. */
    readonly principalId: string
    /** The workspace asked in. */
    readonly workspaceId: string
}

/** Words in the owner's two languages, as a registry declares them. */
export interface RollupWords {
    /** Vietnamese. */
    readonly vi: string
    /** English. */
    readonly en: string
}

/** One operation of a provider as a rights row names it. */
export interface RightOperation {
    /** The operation id: the full tool id. */
    readonly id: string
    /** Its name in the owner's two languages, when a plugin labels it; else null (the page shows the id). */
    readonly title: RollupWords | null
    /** The HTTP method of its operation, for a tool of the OpenAPI provider whose account pinned a document; else null. */
    readonly method: string | null
    /** The path of its operation; else null. */
    readonly path: string | null
    /** Whether it only reads or also acts (every operation is a tool: there is no work action). */
    readonly kind: "read" | "write"
    /** The effect the provider marks on it (`money`, `irreversible`, `none`), or null when it marks none. */
    readonly effect: string | null
}

/** One account an agent is attached to, with how many of the agent's running steps use it and what its provider offers a node. */
export interface AgentRightAccount {
    /** The connected account. */
    readonly connectionId: string
    /** Its provider. */
    readonly provider: string
    /** The kind of account (messaging, payment, books, mail, records), or null for a provider outside the rights catalogue. */
    readonly kind: string | null
    /** The name the owner gave the account. */
    readonly name: string
    /** How many nodes of the agent's running workflows ask for an operation on it. */
    readonly stepsUsing: number
    /** The operations its provider offers an agent: what a node's panel lists to choose from. */
    readonly operations: ReadonlyArray<RightOperation>
}

/** One row of the agent's roll-up: an operation a running node asks for on an account. */
export interface AgentRightRow {
    /** The operation. */
    readonly operation: RightOperation
    /** The connected account. */
    readonly connectionId: string
    /** How the node calls it. */
    readonly mode: "auto" | "ask"
    /** The number of the workflow version that runs and asks for the entry. */
    readonly versionNumber: number
    /** The workflow. */
    readonly workflowId: string
    /** Its key within the agent. */
    readonly workflowKey: string
    /** Its name. */
    readonly workflowName: string
    /** The key of the node in the workflow's graph. */
    readonly nodeKey: string
    /** The id of the step the node runs. */
    readonly step: string
    /** The title of that step as its installed node declares it, in the owner's two languages; null for a step no installed node is. */
    readonly stepTitle: RollupWords | null
}

/** The rights page of one agent. */
export interface AgentNodeRights {
    /** The agent. */
    readonly agentId: string
    /** The accounts the agent is attached to. */
    readonly accounts: ReadonlyArray<AgentRightAccount>
    /** What the agent's running nodes ask for, in workflow, node, account and operation order. */
    readonly rows: ReadonlyArray<AgentRightRow>
}

/** One holder of a right of an account: a node of a running workflow of an agent. */
export interface RightHolder {
    /** The agent. */
    readonly agentId: string
    /** Its name. */
    readonly agentName: string
    /** The workflow. */
    readonly workflowId: string
    /** Its key within the agent. */
    readonly workflowKey: string
    /** Its name. */
    readonly workflowName: string
    /** The key of the node. */
    readonly nodeKey: string
    /** The id of the step the node runs. */
    readonly step: string
    /** The title of that step as its installed node declares it, in the owner's two languages; null for a step no installed node is. */
    readonly stepTitle: RollupWords | null
    /** How the node calls the operation. */
    readonly mode: "auto" | "ask"
    /** The number of the workflow version that runs and asks for the entry. */
    readonly versionNumber: number
}

/** The version of a template a request names, or none (null or absent) for its latest. */
export type MaybeTemplateVersion = number | null | undefined

/** One right an agent may hold on the account: a tool of its provider, with who holds it. */
export interface ProviderToolRight {
    /** The operation. */
    readonly operation: RightOperation
    /** False for an operation of the account's pinned document that no plugin opened as a tool: nobody can hold it. */
    readonly open: boolean
    /** Who holds it; empty when no step asks for it. */
    readonly holders: ReadonlyArray<RightHolder>
}

/** The figures of the filter tabs of the agent tools, counted over every row. */
export interface ProviderRightCounts {
    /** Every row. */
    readonly all: number
    /** The rows some step holds. */
    readonly held: number
    /** The rows no step holds (an operation that is not open is among them). */
    readonly unheld: number
    /** The rows whose operation acts. */
    readonly writes: number
}

/** One read a screen may show of the account: every member of the workspace holds it. */
export interface ProviderScreenRight {
    /** The name a screen calls it by: `<provider>:<read>`. */
    readonly name: string
    /** One line of what it answers, when the registry declares one; else null. */
    readonly summary: RollupWords | null
    /** True: every member of the workspace may read it. */
    readonly everyMember: boolean
}

/** One agent a trigger of the account wakes, and whether it decides on the events or is only told. */
export interface TriggerHolder {
    /** The agent. */
    readonly agentId: string
    /** Its name. */
    readonly agentName: string
    /** `decider`: the one agent that decides on the events; `notice`: it is told. */
    readonly role: "decider" | "notice"
    /** The running workflow of the agent that registers on the trigger, or null for a decider no workflow of which registers. */
    readonly workflowId: string | null
    /** The name of that workflow, or null. */
    readonly workflowName: string | null
    /** The key of that workflow within its agent, or null. */
    readonly workflowKey: string | null
    /** The key of the node an event of the trigger starts: the first node of that workflow; null with no workflow. */
    readonly nodeKey: string | null
    /** The id of the step that node runs, or null. */
    readonly step: string | null
    /** The title of that step as its installed node declares it; null with no workflow, or for a step no installed node is. */
    readonly stepTitle: RollupWords | null
}

/** One trigger of the account's provider, with the agents it wakes. */
export interface ProviderTriggerRight {
    /** Its name inside the provider. */
    readonly name: string
    /** What it is, in the owner's two languages. */
    readonly summary: RollupWords
    /** The agents it wakes. */
    readonly holders: ReadonlyArray<TriggerHolder>
}

/** The rights tab of one connected account: every right of its provider, in three groups, each with who holds it. */
export interface ProviderRightHolders {
    /** The connected account. */
    readonly connectionId: string
    /** Its provider. */
    readonly provider: string
    /** The rights an agent may hold: one row per tool, held or not, open or not. */
    readonly tools: ReadonlyArray<ProviderToolRight>
    /** The figures of the filter tabs over `tools`. */
    readonly counts: ProviderRightCounts
    /** The reads a screen may show: every member holds them. */
    readonly screens: ReadonlyArray<ProviderScreenRight>
    /** The triggers, with the agents they wake. */
    readonly triggers: ReadonlyArray<ProviderTriggerRight>
}

/** One operation a node of a template version asks for on an account, before any install. */
export interface TemplateNodeRequest {
    /** The key of the node. */
    readonly nodeKey: string
    /** The kind of account. */
    readonly kind: string
    /** The provider, or null for any provider of the kind. */
    readonly provider: string | null
    /** The operation, by tool (or action) id. */
    readonly operation: string
    /** The mode the template asks for. */
    readonly mode: "auto" | "ask"
}

/** What a template version's nodes ask for on accounts, for the review before an agent is created. */
export interface TemplateNodeRequests {
    /** The template. */
    readonly templateId: string
    /** The version read. */
    readonly version: number
    /** One row per node, account entry and operation, as the template states them. */
    readonly rights: ReadonlyArray<TemplateNodeRequest>
    /** How many rows. */
    readonly count: number
    /** How many of them wait for a person at each call (`ask`). */
    readonly askCount: number
}
