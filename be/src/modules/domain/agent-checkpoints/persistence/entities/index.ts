import { AgentCheckpointBlobEntity } from "./agent-checkpoint-blob.entity"
import { AgentCheckpointWriteEntity } from "./agent-checkpoint-write.entity"
import { AgentCheckpointEntity } from "./agent-checkpoint.entity"

export { AgentCheckpointBlobEntity, AgentCheckpointEntity, AgentCheckpointWriteEntity }

/** Every entity the agent-checkpoints capability owns, collected by the database connection. */
export const agentCheckpointsEntities: readonly [
    typeof AgentCheckpointEntity,
    typeof AgentCheckpointBlobEntity,
    typeof AgentCheckpointWriteEntity,
] = [AgentCheckpointEntity, AgentCheckpointBlobEntity, AgentCheckpointWriteEntity] as const
