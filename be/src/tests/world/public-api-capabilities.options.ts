import { ContractLinkService, ContractsService } from "@modules/domain/contracts"
import { ConnectionsModule } from "@modules/domain/connections"
import { ConnectionSecretsModule } from "@modules/domain/connection-secrets"
import { DataRecordsReadService } from "@modules/domain/data-records"
import { Injectable, Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ApiKeysService } from "@modules/domain/api-keys"
import { AgentConversationsReadService, AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentsModule, AgentsService } from "@modules/domain/agents"
import { AuthorityService } from "@modules/domain/authority"
import { AuthorityActionsModule } from "@modules/domain/authority-actions"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { DurableWorkService, EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import type { InboundEventStatus, LeadGenFlow, OutboundAccessGate } from "@modules/domain/decisions"
import { EventsModule } from "@modules/domain/events"
import { ExecutionsModule } from "@modules/domain/executions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { ApiKnowledgeSourcesService, SourceQuotaService } from "@modules/domain/knowledge-sources"
import { KNOWLEDGE_STORAGE } from "../../modules/domain/knowledge-sources/knowledge-sources.decorators"
import { LeadReadService, LeadRecordsService } from "@modules/domain/leads"
import { AGENT_DIRECTORY, OfficeLinesService } from "@modules/domain/messages"
import type { AgentDirectory } from "@modules/domain/messages"
import { MODULE_CATALOG, MODULE_CATEGORIES, ModulesModule, ModulesService } from "@modules/domain/modules"
import { PublicApiModule } from "@modules/domain/public-api"
import { RESPONSIBILITY_LEAD_DESK, ResponsibilitiesModule } from "@modules/domain/responsibilities"
import type { LeadDesk } from "@modules/domain/responsibilities"
import { StaffModule } from "@modules/domain/staff"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { refused } from "@modules/platform/primitives"
import { Secret } from "@modules/platform/config"
import { EVENT_BUS } from "@modules/platform/event-bus"
import type { EventBus } from "@modules/platform/event-bus"
import { WebhookEventsService } from "@modules/domain/webhook-connections"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import { InstallationOperationsService, InstallationRecordsService } from "@modules/domain/module-installations"
import { InvoicesLedgerService } from "@modules/domain/invoices"
import { OrdersLabelReadService } from "@modules/domain/orders"
import { WorkItemsChainReadService, WorkItemsLeadReadService, WorkItemsService } from "@modules/domain/work-items"
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
    MODULE_CATALOG_SOURCE,
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

    agentById(): ReturnType<AgentDirectory["agentById"]> {
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

/** The connection key of the public api proofs: a local test key of their own, never a deployed one. */
const PUBLIC_API_PROOF_TOKEN_KEY = new Secret(Buffer.alloc(32, 13).toString("base64"))

@Injectable()
/** The object storage of the knowledge sources: the legacy inline sources hold no object, so any read of the store is refused as unavailable. */
class PublicApiProofStorage implements StorageObjectsPort {
    signedUpload(): ReturnType<StorageObjectsPort["signedUpload"]> {
        return Promise.resolve(refused("OBJECT_STORAGE_UNAVAILABLE"))
    }

    download(): ReturnType<StorageObjectsPort["download"]> {
        return Promise.resolve(refused("OBJECT_STORAGE_UNAVAILABLE"))
    }

    sizeOf(): ReturnType<StorageObjectsPort["sizeOf"]> {
        return Promise.resolve(refused("OBJECT_STORAGE_UNAVAILABLE"))
    }

    list(): ReturnType<StorageObjectsPort["list"]> {
        return Promise.resolve(refused("OBJECT_STORAGE_UNAVAILABLE"))
    }

    signedUrls(): ReturnType<StorageObjectsPort["signedUrls"]> {
        return Promise.resolve(refused("OBJECT_STORAGE_UNAVAILABLE"))
    }

    remove(): ReturnType<StorageObjectsPort["remove"]> {
        return Promise.resolve(refused("OBJECT_STORAGE_UNAVAILABLE"))
    }

    publicUrl(bucket: string, path: string): string {
        return `${bucket}/${path}`
    }
}

@Injectable()
/** The customers the journal shows: the real lead reads and the real hold, bound the way the leads capability binds them. */
class PublicApiProofLeadDesk implements LeadDesk {
    constructor(
        private readonly reads: LeadReadService,
        private readonly records: LeadRecordsService,
    ) {}

    async cardsOf(workspaceId: string, leadIds: ReadonlyArray<string>): ReturnType<LeadDesk["cardsOf"]> {
        const cards = await this.reads.cardsOf(workspaceId, leadIds)
        return cards.map(({ id, contactName, company, stage }) => ({ id, contactName, company, stage }))
    }

    hold(workspaceId: string, leadId: string, manager: EntityManager): Promise<boolean> {
        return this.records.hold(workspaceId, leadId, manager)
    }
}

@Module({})
class PublicApiProofPeersModule {
    static register(): DynamicModule {
        const services = [
            ApiKeysService,
            AgentConversationsService,
            AgentConversationsReadService,
            ApiKnowledgeSourcesService,
            ContractsService,
            ContractLinkService,
            DataRecordsReadService,
            AuthorityService,
            CommandPlannerService,
            DurableWorkService,
            EvidenceService,
            InboundEventsService,
            LeadReadService,
            LeadRecordsService,
            ModuleCatalogService,
            SourceQuotaService,
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
            WorkItemsChainReadService,
            WorkItemsLeadReadService,
            InstallationRecordsService,
            InstallationOperationsService,
            InvoicesLedgerService,
            OrdersLabelReadService,
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
                { provide: KNOWLEDGE_STORAGE, useClass: PublicApiProofStorage },
                { provide: RESPONSIBILITY_LEAD_DESK, useClass: PublicApiProofLeadDesk },
                { provide: AGENT_DIRECTORY, useExisting: PublicApiProofDirectory },
                { provide: AgentsService, useExisting: PublicApiProofDirectory },
                { provide: INBOX, useClass: InboxService },
                { provide: INBOUND_EVENT_STATUS, useClass: PublicApiProofInbound },
                { provide: LEAD_GEN_FLOW, useClass: PublicApiProofChain },
                { provide: MODULE_CATALOG_SOURCE, useExisting: ModulesService },
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
            exports: [...services, RESPONSIBILITY_LEAD_DESK],
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
    AgentsModule.register({ isGlobal: true, directoryOnly: true }),
    ConnectionSecretsModule.register({ isGlobal: true, tokenKey: PUBLIC_API_PROOF_TOKEN_KEY }),
    ConnectionsModule.register({
        isGlobal: true,
        channelTokenKey: PUBLIC_API_PROOF_TOKEN_KEY,
        siteUrl: "http://localhost",
        publicSiteUrl: undefined,
    }),
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
