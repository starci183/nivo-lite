import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import type { NivoApiOpGroup } from "@modules/domain/nivo-api"
import { AgentRunBoardService, AgentRunDecisionsService, AgentRunPageService } from "@modules/domain/agent-pages"
import { DecideAgentRunStepCommand } from "./application/decide-agent-run-step.command"
import { DecideAgentRunStepHandler } from "./application/decide-agent-run-step.handler"
import { ReadAgentRunHandler } from "./application/read-agent-run.handler"
import { ReadAgentRunQuery } from "./application/read-agent-run.query"
import { ReadAgentRunsHandler } from "./application/read-agent-runs.handler"
import { ReadAgentRunsQuery } from "./application/read-agent-runs.query"

/** The run ops of the outbound MCP surface: the message each op sends to the agent work handlers, with those handlers. */
export const AGENT_WORK_NIVO_API_OPS: NivoApiOpGroup = {
    handlers: [
        AgentRunBoardService,
        AgentRunPageService,
        AgentRunDecisionsService,
        ReadAgentRunsHandler,
        ReadAgentRunHandler,
        DecideAgentRunStepHandler,
    ],
    queries: {
        [NIVO_API.run.list]: ReadAgentRunsQuery,
        [NIVO_API.run.get]: ReadAgentRunQuery,
    },
    commands: {
        [NIVO_API.run.stepDecide]: DecideAgentRunStepCommand,
    },
}
