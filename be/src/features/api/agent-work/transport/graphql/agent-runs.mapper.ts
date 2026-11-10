import type {
    AgentRunDetail,
    AgentRunsBoard,
    ReadAgentRunRequest,
    ReadAgentRunsRequest,
} from "../../application/read-agent-runs.contracts"
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
export const toReadAgentRunRequest = (workspaceId: string, input: AgentRunInput): ReadAgentRunRequest => ({
    workspaceId,
    installationId: input.installationId,
    runId: input.runId,
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

/** Maps one run with its steps to the GraphQL type; null when the agent has no such run. */
export const toAgentRunDetailType = (detail: AgentRunDetail | null): AgentRunDetailType | null =>
    detail === null
        ? null
        : {
              row: { ...detail.row },
              steps: detail.steps.map((step) => ({
                  ...step,
                  input: step.input.map((fact) => ({ ...fact })),
                  output: step.output.map((fact) => ({ ...fact })),
                  calls: step.calls.map((call) => ({ ...call })),
              })),
              item:
                  detail.item === null
                      ? null
                      : { ...detail.item, evidence: detail.item.evidence.map((fact) => ({ ...fact })) },
              canResume: detail.canResume,
              canCancel: detail.canCancel,
              decision: detail.decision === null ? null : { ...detail.decision, options: [...detail.decision.options] },
          }
