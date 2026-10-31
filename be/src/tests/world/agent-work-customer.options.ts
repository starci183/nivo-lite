import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentConversationsModule } from "@modules/domain/agent-conversations"
import { jobsEntities } from "@modules/platform/jobs"
import { ChatTurnModule } from "@modules/queues/chat-turn"
import { AgentWorkSettingsEntity } from "../../modules/domain/agent-work/persistence/entities"
import { CustomerIntakeService } from "../../modules/domain/conversations/customer-intake.service"
import { agentRoadModules } from "./agent-road-capabilities.options"

@Module({})
class CustomerIntakeProofModule {
    /** Provides the intake alone, over the real store and the real outbox, so the proof reads rows and not doubles. */
    static register(): DynamicModule {
        return {
            module: CustomerIntakeProofModule,
            global: true,
            providers: [CustomerIntakeService],
            exports: [CustomerIntakeService],
        }
    }
}

/** The road's world with the customer intake on top: the work store, the chat-turn queue and the intake that picks between them. */
export const agentCustomerModules = (prefix: string) => [
    ...agentRoadModules(prefix),
    AgentConversationsModule.register({ isGlobal: true }),
    ChatTurnModule.register({}),
    CustomerIntakeProofModule.register(),
]

const [, JobOutboxEntity] = jobsEntities

/** The chat-turn jobs the outbox holds for a customer message. */
export const chatJobsOf = (manager: EntityManager, messageId: string) =>
    manager.find(JobOutboxEntity, { where: { queue: "chat_turn", dedupeKey: `chat-turn.turn:${messageId}` }, take: 5 })

/** Removes the chat-turn jobs and the settings row a workspace's proofs wrote. */
export const removeCustomerRows = async (manager: EntityManager, workspaceId: string): Promise<void> => {
    await manager.delete(JobOutboxEntity, { queue: "chat_turn", workspaceId })
    await manager.delete(AgentWorkSettingsEntity, { workspaceId })
}
