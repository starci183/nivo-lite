import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import type { NivoApiOpGroup } from "@modules/domain/nivo-api"
import { GetBrainGraphHandler } from "./application/get-brain-graph.handler"
import { GetBrainGraphQuery } from "./application/get-brain-graph.query"

/** The truth graph search op of the outbound MCP surface: the message it sends to the brain graph handler, with that handler. */
export const BRAIN_GRAPH_NIVO_API_OPS: NivoApiOpGroup = {
    handlers: [GetBrainGraphHandler],
    queries: {
        [NIVO_API.brain.search]: GetBrainGraphQuery,
    },
    commands: {},
}
