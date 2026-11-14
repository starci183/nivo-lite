import { AgentRunStepEntity } from "./agent-run-step.entity"
import { AgentRunEntity } from "./agent-run.entity"

export { AgentRunEntity, AgentRunStepEntity }

/** The entities the agent runs own, collected by the database module. */
export const agentRunsEntities: readonly [typeof AgentRunEntity, typeof AgentRunStepEntity] = [
    AgentRunEntity,
    AgentRunStepEntity,
] as const
