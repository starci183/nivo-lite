import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import type { NivoApiOpGroup } from "@modules/domain/nivo-api"
import { RunStopDecisionsService, RunStopsPageService } from "@modules/domain/agent-pages"
import { DecideRunStopCommand } from "./application/decide-run-stop.command"
import { DecideRunStopHandler } from "./application/decide-run-stop.handler"
import { RunStopsHandler } from "./application/run-stops.handler"
import { RunStopsQuery } from "./application/run-stops.query"

/** The stop ops of the outbound MCP surface: the message each op sends to the run stops handlers, with those handlers. */
export const AGENT_RUNS_NIVO_API_OPS: NivoApiOpGroup = {
    handlers: [RunStopDecisionsService, RunStopsPageService, RunStopsHandler, DecideRunStopHandler],
    queries: {
        [NIVO_API.stop.list]: RunStopsQuery,
    },
    commands: {
        [NIVO_API.stop.answer]: DecideRunStopCommand,
    },
}
