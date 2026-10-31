import { AgentGoalEntity } from "./agent-goal.entity"
import { AgentTaskEntity } from "./agent-task.entity"
import { AgentTriggerEntity } from "./agent-trigger.entity"
import { AgentTurnEntity } from "./agent-turn.entity"
import { AgentWakeEntity } from "./agent-wake.entity"
import { AgentWorkLeaseEntity } from "./agent-work-lease.entity"
import { AgentWorkSettingsEntity } from "./agent-work-settings.entity"
import { AgentWorkStateEntity } from "./agent-work-state.entity"

export { AgentGoalEntity } from "./agent-goal.entity"
export { AgentTaskEntity } from "./agent-task.entity"
export { AgentTriggerEntity } from "./agent-trigger.entity"
export { AgentTurnEntity } from "./agent-turn.entity"
export { AgentWakeEntity } from "./agent-wake.entity"
export { AgentWorkLeaseEntity } from "./agent-work-lease.entity"
export { AgentWorkSettingsEntity } from "./agent-work-settings.entity"
export { AgentWorkStateEntity } from "./agent-work-state.entity"

/** Every entity of the agent-work capability. */
export const agentWorkEntities = [
    AgentWorkSettingsEntity,
    AgentWorkStateEntity,
    AgentWorkLeaseEntity,
    AgentGoalEntity,
    AgentTaskEntity,
    AgentTriggerEntity,
    AgentWakeEntity,
    AgentTurnEntity,
] as const
