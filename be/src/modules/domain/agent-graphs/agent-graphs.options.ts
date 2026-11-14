import type { Type } from "@nestjs/common"
import type { GraphFactReader } from "./agent-graphs.port"

/** What the action graph needs from the app root: the declarations of the facts a decide point may name. */
export interface AgentGraphsOptions {
    /** One declaration for each module that declares graph facts, read by the checks of a saved or published graph. */
    readonly readers?: ReadonlyArray<Type<GraphFactReader>>
    /** Only the data rights of the gateway: the store and the rights, none of the work engine behind the rest of the graph (the MCP endpoint). */
    readonly rightsOnly?: boolean
    /** Only the store of the graphs and the publishing of a flow onto it (the cli seed): none of the work engine, the gateway or the approval road. */
    readonly storeOnly?: boolean
    /**
     * Only the people's doors to the workflows (the mcp app): the stores, the workflows' reads and the start that writes a wake for the
     * api's engine; none of the engine that walks a graph.
     */
    readonly doorsOnly?: boolean
}
