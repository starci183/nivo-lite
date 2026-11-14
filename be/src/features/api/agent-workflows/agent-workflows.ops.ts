import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import type { NivoApiOpGroup } from "@modules/domain/nivo-api"
import { AgentWorkflowListService } from "@modules/domain/agent-pages"
import { AgentWorkflowsHandler } from "./application/agent-workflows.handler"
import { AgentWorkflowsQuery } from "./application/agent-workflows.query"
import { RunWorkflowCommand } from "./application/run-workflow.command"
import { RunWorkflowHandler } from "./application/run-workflow.handler"
import { RunnableWorkflowHandler } from "./application/runnable-workflow.handler"
import { RunnableWorkflowQuery } from "./application/runnable-workflow.query"

/** The workflow ops of the outbound MCP surface: the message each op sends to the workflows handlers, with those handlers. */
export const AGENT_WORKFLOWS_NIVO_API_OPS: NivoApiOpGroup = {
    handlers: [AgentWorkflowListService, AgentWorkflowsHandler, RunnableWorkflowHandler, RunWorkflowHandler],
    queries: {
        [NIVO_API.workflow.list]: AgentWorkflowsQuery,
        [NIVO_API.workflow.get]: RunnableWorkflowQuery,
    },
    commands: {
        [NIVO_API.workflow.run]: RunWorkflowCommand,
    },
}
