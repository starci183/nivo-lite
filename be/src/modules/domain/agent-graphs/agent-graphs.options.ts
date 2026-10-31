import type { Type } from "@nestjs/common"
import type { GraphFactReader } from "./agent-graphs.port"

/** What the action graph needs from the app root: the readers of the facts a decide point reads from real records. */
export interface AgentGraphsOptions {
    /** One reader for each module that declares graph facts; a fact with no reader is never read, so its branch falls to the else. */
    readonly readers?: ReadonlyArray<Type<GraphFactReader>>
    /** The time a fact read may take, milliseconds (2 s). */
    readonly readTimeoutMs?: number
}
