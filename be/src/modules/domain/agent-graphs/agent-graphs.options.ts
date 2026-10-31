import type { Type } from "@nestjs/common"
import type { GraphFactReader } from "./agent-graphs.port"

/** What the action graph needs from the app root: the readers of the facts a decide point reads from real records. */
export interface AgentGraphsOptions {
    /** One reader for each module that declares graph facts; a fact with no reader is never read, so its branch falls to the else. */
    readonly readers?: ReadonlyArray<Type<GraphFactReader>>
    /** Only the data rights of the gateway: the store and the rights, none of the work engine behind the rest of the graph (the MCP endpoint). */
    readonly rightsOnly?: boolean
    /** Only the branch decider with its store, its ledger and its fact readers, with no approval road behind it. */
    readonly deciderOnly?: boolean
    /** The time a fact read may take, milliseconds (2 s). */
    readonly readTimeoutMs?: number
}
