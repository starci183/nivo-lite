import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AGENTS_INSTALLATIONS } from "@modules/domain/agents"
import { INBOUND_ADAPTER_REGISTRY } from "../../modules/domain/agent-inbound/agent-inbound.decorators"
import { InboundAdapterRegistryService } from "../../modules/domain/agent-inbound/inbound-adapter-registry.service"
import { InboundDoorService } from "../../modules/domain/agent-inbound/inbound-door.service"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { AgentConversationsModule } from "@modules/domain/agent-conversations"
import { jobsEntities } from "@modules/platform/jobs"
import { ChatTurnModule } from "@modules/queues/chat-turn"
import { AgentWorkSettingsEntity } from "../../modules/domain/agent-work/persistence/entities"
import { CustomerIntakeService } from "../../modules/domain/conversations/customer-intake.service"
import { AgentEventWakesService } from "../../modules/domain/agent-schedules/agent-event-wakes.service"
import { QUIET_INSTALLATIONS, QUIET_RUNS } from "./quiet-peers"
import { agentRoadModules } from "./agent-road-capabilities.options"

@Module({})
class CustomerIntakeProofModule {
    /** Provides the intake alone, over the real store and the real outbox, so the proof reads rows and not doubles. */
    static register(): DynamicModule {
        return {
            module: CustomerIntakeProofModule,
            global: true,
            imports: [ChatTurnModule.register({})],
            providers: [
                CustomerIntakeService,
                QUIET_INSTALLATIONS,
                QUIET_RUNS,
                AgentEventWakesService,
                InboundDoorService,
                InboundAdapterRegistryService,
                { provide: INBOUND_ADAPTER_REGISTRY, useExisting: InboundAdapterRegistryService },
                { provide: INBOX, useClass: InboxService },
            ],
            exports: [CustomerIntakeService, AGENTS_INSTALLATIONS, AgentEventWakesService, InboundDoorService],
        }
    }
}

/** The road's world with the customer intake on top: the work store, the chat-turn queue and the intake that picks between them. */
export const agentCustomerModules = (prefix: string): Array<DynamicModule> => [
    ...agentRoadModules(prefix),
    AgentConversationsModule.register({ isGlobal: true }),
    CustomerIntakeProofModule.register(),
]

const JobOutboxEntity: (typeof jobsEntities)[1] = jobsEntities[1]
type JobOutboxEntity = InstanceType<typeof JobOutboxEntity>

/** The chat-turn jobs the outbox holds for a customer message. */
export const chatJobsOf = (manager: EntityManager, messageId: string): Promise<Array<JobOutboxEntity>> =>
    manager.find(JobOutboxEntity, { where: { queue: "chat_turn", dedupeKey: `chat-turn.turn:${messageId}` }, take: 5 })

/** Removes the chat-turn jobs and the settings row a workspace's proofs wrote. */
export const removeCustomerRows = async (manager: EntityManager, workspaceId: string): Promise<void> => {
    await manager.delete(JobOutboxEntity, { queue: "chat_turn", workspaceId })
    await manager.delete(AgentWorkSettingsEntity, { workspaceId })
}
