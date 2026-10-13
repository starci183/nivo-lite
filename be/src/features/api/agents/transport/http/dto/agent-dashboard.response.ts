/** One region of the dashboard: its data, or the fact that it could not be read. */
export class RegionResponse<T> {
    /** True when the region was read. */
    ok!: boolean
    /** The data of the region; absent when it could not be read. */
    data?: T
}

/** The installed agent of the dashboard. */
export class DashboardAgentResponse {
    /** The agent. */
    id!: string
    /** The display name. */
    name!: string
    /** `assist` or `autopilot`. */
    mode!: string
}

/** One line of a list region: a decision waiting, or something the agent finished. */
export class DashboardItemResponse {
    /** The work item. */
    id!: string
    /** The one-line summary, clipped; empty when the item has none. */
    title!: string
    /** The action key, for the label. */
    action!: string
    /** The customer the item is about, or an empty text. */
    customer!: string
    /** When it was raised or finished, ISO 8601. */
    at!: string
    /** The lead the item is about, or null. */
    leadId!: string | null
    /** The href the finished work recorded as its evidence, or null. */
    resultHref!: string | null
    /** The workbench link that opens this decision. */
    decisionHref!: string
}

/** The decisions of the module that wait for a person. */
export class WaitingResponse {
    /** How many wait. */
    total!: number
    /** The oldest few. */
    items!: ReadonlyArray<DashboardItemResponse>
}

/** The work finished by policy in the last seven days. */
export class DoneResponse {
    /** How many finished. */
    count!: number
    /** The latest few. */
    items!: ReadonlyArray<DashboardItemResponse>
}

/** One connection bound to the agent. */
export class DashboardConnectionResponse {
    /** The connection. */
    id!: string
    /** The display name. */
    name!: string
    /** The provider key. */
    provider!: string
    /** The bot username, when the provider has one. */
    botUsername!: string | null
    /** The masked bank account, when the connection is a bank feed. */
    accountMasked!: string | null
    /** `connected`, `error` or `pending`. */
    status!: string
    /** What the agent may do through it. */
    access!: string
    /** What the agent uses it for. */
    purpose!: string
}

/** How many documents the agent can read, by visibility. */
export class DocumentCountsResponse {
    /** Documents anyone may see. */
    public!: number
    /** Documents for the team. */
    internal!: number
}

/** How many facts the agent can read, by visibility. */
export class FactCountsResponse {
    /** Facts anyone may see. */
    public!: number
    /** Facts for the team. */
    internal!: number
    /** Facts restricted to named agents. */
    restricted!: number
}

/** One question the agent could not answer. */
export class KnowledgeGapResponse {
    /** The gap. */
    id!: string
    /** The question, clipped. */
    question!: string
    /** How often it was asked. */
    count!: number
    /** When it was last asked, ISO 8601. */
    lastSeenAt!: string
}

/** The open gaps of a module. */
export class OpenGapsResponse {
    /** How many gaps are open. */
    openCount!: number
    /** The most asked few. */
    items!: ReadonlyArray<KnowledgeGapResponse>
}

/** What the agent can read and, for a manager, what it could not answer. */
export class KnowledgeResponse {
    /** `customer` or `internal`. */
    audience!: string
    /** Documents by visibility. */
    documents!: DocumentCountsResponse
    /** Facts by visibility. */
    facts!: FactCountsResponse
    /** The open gaps; null when the reader is not a manager or the gaps are not kept. */
    gaps!: OpenGapsResponse | null
}

/** Everything the common regions of an agent dashboard need for one module. */
export class AgentDashboardResponse {
    /** The installed agent, or null when the module has none yet. */
    agent!: DashboardAgentResponse | null
    /** The decisions waiting for a person. */
    waiting!: RegionResponse<WaitingResponse>
    /** The work finished by policy in seven days. */
    done!: RegionResponse<DoneResponse>
    /** The connections bound to the agent. */
    connections!: RegionResponse<ReadonlyArray<DashboardConnectionResponse>>
    /** What the agent can read. */
    knowledge!: RegionResponse<KnowledgeResponse>
}
