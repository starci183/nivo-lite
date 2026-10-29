import { ContractLinkService, ContractsService } from "@modules/domain/contracts"
import { Injectable, Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ApiKeysService } from "@modules/domain/api-keys"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentsService } from "@modules/domain/agents"
import { AuthorityService } from "@modules/domain/authority"
import { AuthorityActionsModule } from "@modules/domain/authority-actions"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { DurableWorkService, EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import type { InboundEventStatus, LeadGenFlow, OutboundAccessGate } from "@modules/domain/decisions"
import { EventsModule } from "@modules/domain/events"
import { ExecutionsModule } from "@modules/domain/executions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { ApiKnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { LeadRecordsService } from "@modules/domain/leads"
import { AGENT_DIRECTORY, OfficeLinesService } from "@modules/domain/messages"
import type { AgentDirectory } from "@modules/domain/messages"
import { MODULE_CATALOG, MODULE_CATEGORIES, ModulesModule } from "@modules/domain/modules"
import { PublicApiModule } from "@modules/domain/public-api"
import { ResponsibilitiesModule } from "@modules/domain/responsibilities"
import { StaffModule } from "@modules/domain/staff"
import { EVENT_BUS } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { WebhookEventsService } from "@modules/domain/webhook-connections"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import { WorkItemsService } from "@modules/domain/work-items"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { I18nModule } from "@modules/platform/i18n"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { IdsModule } from "@modules/platform/ids"
import { JobsModule } from "@modules/platform/jobs"
import { QueueModule } from "@modules/platform/queue"
import type { QueueOptions } from "@modules/platform/queue"
import { KnowledgeQueueModule } from "@modules/queues/knowledge"
import { CommandPlannerService } from "../../modules/domain/decisions/command-planner.service"
import { ModuleCatalogService } from "../../modules/domain/decisions/module-catalog.service"
import { WorkApprovalService } from "../../modules/domain/decisions/work-approval.service"
import { WorkChainService } from "../../modules/domain/decisions/work-chain.service"
import {
    INBOUND_EVENT_STATUS,
    LEAD_GEN_FLOW,
    OUTBOUND_ACCESS_GATE,
} from "../../modules/domain/decisions/work-engine.decorators"
import { WorkIntakeService } from "../../modules/domain/decisions/work-intake.service"
import { WORK_PERFORMER_REGISTRY } from "../../modules/domain/decisions/work-performer.port"
import { WorkPerformersService } from "../../modules/domain/decisions/work-performers.service"
import { WorkRecorderService } from "../../modules/domain/decisions/work-recorder.service"
import { HandoffLeadPerformerService } from "../../modules/domain/work-performers/handoff-lead-performer.service"
import { PerformerKitService } from "../../modules/domain/work-performers/performer-kit.service"
import { queueOptions } from "./test-capabilities.options"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

@Injectable()
/** No agent or authentication account lookup is needed to admit an API request. */
export class PublicApiProofDirectory implements AgentDirectory, AccountDirectory {
    agentOfDepartment(): ReturnType<AgentDirectory["agentOfDepartment"]> {
        return Promise.resolve(null)
    }

    accountOf(): ReturnType<AccountDirectory["accountOf"]> {
        return Promise.reject(new TestWorldError({ code: TestWorldErrorCode.AccountsUnread }))
    }
}

@Injectable()
/** The proof controls only the connection's access; the persisted authority rule still decides every item. */
export class PublicApiProofAccess implements OutboundAccessGate {
    access: "auto" | "ask" = "auto"

    accessOf(): ReturnType<OutboundAccessGate["accessOf"]> {
        return Promise.resolve(this.access)
    }
}

/** A message explicitly has no chain; reaching another department is a failed proof. */
@Injectable()
class PublicApiProofChain implements LeadGenFlow {
    continueAfter(): Promise<void> {
        return Promise.reject(new TestWorldError({ code: TestWorldErrorCode.TransactionRefused }))
    }
}

@Injectable()
class PublicApiProofInbound implements InboundEventStatus {
    constructor(private readonly inbound: InboundEventsService) {}

    mark(...[ctx, id, status, leadId]: Parameters<InboundEventStatus["mark"]>): Promise<void> {
        return this.inbound.mark(ctx.workspaceId, id, status, leadId)
    }
}

@Module({})
class PublicApiProofPeersModule {
    static register(): DynamicModule {
        const services = [
            ApiKeysService,
            AgentConversationsService,
            ApiKnowledgeSourcesService,
            ContractsService,
            ContractLinkService,
            AuthorityService,
            CommandPlannerService,
            DurableWorkService,
            EvidenceService,
            InboundEventsService,
            LeadRecordsService,
            ModuleCatalogService,
            OfficeLinesService,
            PublicApiProofDirectory,
            PublicApiProofAccess,
            HandoffLeadPerformerService,
            PerformerKitService,
            WorkApprovalService,
            WorkChainService,
            WorkEngineService,
            WorkIntakeService,
            WorkItemsService,
            WorkPerformersService,
            WorkRecorderService,
            AuthorityRulesService,
        ]
        return {
            module: PublicApiProofPeersModule,
            global: true,
            imports: [KnowledgeQueueModule.register({})],
            providers: [
                ...services,
                { provide: AGENT_DIRECTORY, useExisting: PublicApiProofDirectory },
                { provide: AgentsService, useExisting: PublicApiProofDirectory },
                { provide: INBOX, useClass: InboxService },
                { provide: INBOUND_EVENT_STATUS, useClass: PublicApiProofInbound },
                { provide: LEAD_GEN_FLOW, useClass: PublicApiProofChain },
                { provide: OUTBOUND_ACCESS_GATE, useExisting: PublicApiProofAccess },
                { provide: WORK_PERFORMER_REGISTRY, useExisting: WorkPerformersService },
                {
                    provide: EVENT_BUS,
                    useFactory: (): Pick<EventBus, "publish"> => ({ publish: () => Promise.resolve() }),
                },
                {
                    provide: WebhookEventsService,
                    useFactory: (): Pick<WebhookEventsService, "publish"> => ({ publish: () => Promise.resolve() }),
                },
            ],
            exports: services,
        }
    }
}

/** Real queue, ledger, inbox and work owners; only external ports are supplied by the proof. */
export const publicApiProofModules = (options: QueueOptions) => [
    // The proof captures the router without starting a poller, so teardown has no in-flight transport delivery to await.
    QueueModule.register({ ...options, enabled: true, isGlobal: true }),
    JobsModule.register({
        isGlobal: true,
        connection: PRIMARY_ENTITY_MANAGER,
        workerId: "public-api-proof",
        leaseMs: 1000,
        scheduler: { enabled: false },
    }),
    I18nModule.register({ isGlobal: true, bundles: [] }),
    // The real work items service stamps each new item with an id from this port.
    IdsModule.register({ isGlobal: true }),
    EventsModule.register({ isGlobal: true }),
    AuthorityActionsModule.register({ isGlobal: true }),
    StaffModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true, accounts: PublicApiProofDirectory }),
    ResponsibilitiesModule.register({ isGlobal: true, agentDirectory: PublicApiProofDirectory }),
    ExecutionsModule.register({ isGlobal: true }),
    ModulesModule.register({
        isGlobal: true,
        catalogOnly: true,
        catalog: MODULE_CATALOG,
        categories: MODULE_CATEGORIES,
    }),
    PublicApiProofPeersModule.register(),
    PublicApiModule.register({ isGlobal: true }),
]

/** Existing persisted routing proofs capture their worker without opening a broker connection. */
export const PUBLIC_API_PROOF_MODULES = publicApiProofModules({ ...queueOptions, shutdownGraceMs: 0 })
