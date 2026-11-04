import type { OwnerResumeAnswer } from "@modules/domain/agent-runs"
import type { ResumeAgentRunRequest } from "../../application/resume-agent-run.contracts"
import type { AgentRunResumeType } from "./dto/agent-run-resume.type"
import type { ResumeAgentRunInput } from "./dto/resume-agent-run.input"

/** Maps the GraphQL arguments of resumeAgentRun to the request. */
export const toResumeAgentRunRequest = (workspaceId: string, input: ResumeAgentRunInput): ResumeAgentRunRequest => ({
    workspaceId,
    runId: input.runId,
    reason: input.reason,
})

/** Maps the answer of resumeAgentRun to the GraphQL type. */
export const toAgentRunResumeType = (result: OwnerResumeAnswer): AgentRunResumeType => result
