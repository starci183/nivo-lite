import { AgentRunStepEntity } from "./agent-run-step.entity"
import { AgentRunEntity } from "./agent-run.entity"

export { AgentRunStepEntity } from "./agent-run-step.entity"
export { AgentRunEntity } from "./agent-run.entity"

/** Every entity of the agent-runs capability. */
export const agentRunsEntities: readonly [typeof AgentRunEntity, typeof AgentRunStepEntity] = [
    AgentRunEntity,
    AgentRunStepEntity,
] as const
