import type { Locale } from "@modules/platform/i18n"
import type { AgentRunDetail, AgentRunsBoard } from "@modules/domain/agent-work"
import type { ReadAgentRunRequest, ReadAgentRunsRequest } from "../../application/read-agent-runs.contracts"
import type { AgentRunDetailType } from "./dto/agent-run-detail.type"
import type { AgentRunInput } from "./dto/agent-run.input"
import type { AgentRunsType } from "./dto/agent-run.type"
import type { AgentWorkInstanceInput } from "./dto/agent-work-instance.input"

/** Maps the instance of the GraphQL input, with the workspace it names, to the request that reads its runs. */
export const toReadAgentRunsRequest = (workspaceId: string, input: AgentWorkInstanceInput): ReadAgentRunsRequest => ({
    workspaceId,
    installationId: input.installationId,
})

/** Maps the run of the GraphQL input, with the workspace it names, to the request that reads it. */
export const toReadAgentRunRequest = (workspaceId: string, input: AgentRunInput, locale?: Locale): ReadAgentRunRequest => ({
    workspaceId,
    installationId: input.installationId,
    runId: input.runId,
    locale,
})

/** Maps the runs of an agent to the GraphQL type. */
export const toAgentRunsType = (board: AgentRunsBoard): AgentRunsType => ({
    runs: board.runs.map((row) => ({ ...row })),
    workflows: board.workflows.map((workflow) => ({ ...workflow })),
    runningCount: board.runningCount,
    queuedCount: board.queuedCount,
    concurrencyLimit: board.concurrencyLimit,
    activeCount: board.activeCount,
})

/** Maps one run with its steps to the GraphQL type (its shape already is the type's); null when the agent has no such run. */
export const toAgentRunDetailType = (detail: AgentRunDetail | null): AgentRunDetailType | null => detail
