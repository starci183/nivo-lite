import { ConnectionsModule } from "@modules/domain/connections"
import { ConnectionSecretsModule } from "@modules/domain/connection-secrets"
import { DataRecordsReadService } from "@modules/domain/data-records"
import { Injectable, Module, type DynamicModule } from "@nestjs/common"
import { ApiKeysService } from "@modules/domain/api-keys"
import { AGENTS_INSTALLATIONS, AgentsModule, AgentsService } from "@modules/domain/agents"
import { AuthorityService } from "@modules/domain/authority"
import { AuthorityActionsModule } from "@modules/domain/authority-actions"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { ChatRecordsModule } from "@modules/domain/chat-records"
import {
    DurableWorkService,
    EvidenceService,
    WorkEngineService,
    type InboundEventStatus,
    type OutboundAccessGate,
} from "@modules/domain/decisions"
import { EntityEngineModule, ReadOnlyEngineAlertsService } from "@modules/domain/entity-engine"
import { EventsModule } from "@modules/domain/events"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { ApiKnowledgeSourcesService, SourceQuotaService } from "@modules/domain/knowledge-sources"
import { KNOWLEDGE_STORAGE } from "../../modules/domain/knowledge-sources/knowledge-sources.decorators"
import { AGENT_DIRECTORY, OfficeLinesService, type AgentDirectory } from "@modules/domain/messages"
import { MODULE_CATALOG, MODULE_CATEGORIES, ModulesModule, ModulesService } from "@modules/domain/modules"
import { PublicApiModule } from "@modules/domain/public-api"
import { StaffModule } from "@modules/domain/staff"
import { WorkspacesModule } from "@modules/domain/workspaces"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { refused } from "@modules/platform/primitives"
import { Secret } from "@modules/platform/config"
import { EVENT_BUS, type EventBus } from "@modules/platform/event-bus"
import { WebhookEventsService } from "@modules/domain/webhook-connections"
import { FLOW_F_ENTITIES } from "@nivo-lite/blocks-core/entities"
import { MODULE_JOBS } from "@nivo-lite/blocks-core/modules"
import { WorkspaceMembersModule, type AccountDirectory } from "@modules/domain/workspace-members"
import { InstallationOperationsService, InstallationRecordsService } from "@modules/domain/module-installations"
import { InvoicesLedgerService } from "@modules/domain/invoices"
import { WorkItemsChainReadService, WorkItemsService } from "@modules/domain/work-items"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { I18nModule } from "@modules/platform/i18n"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { IdsModule } from "@modules/platform/ids"
import { JobsModule } from "@modules/platform/jobs"
import { QueueModule, type QueueOptions } from "@modules/platform/queue"
import { KnowledgeQueueModule } from "@modules/queues/knowledge"
import { CommandPlannerService } from "../../modules/domain/decisions/command-planner.service"
import { ModuleCatalogService } from "../../modules/domain/decisions/module-catalog.service"
import { WorkApprovalService } from "../../modules/domain/decisions/work-approval.service"
import type { WorkAskCards } from "../../modules/domain/decisions/work-lines.contracts"
import { WorkLinesService } from "../../modules/domain/decisions/work-lines.service"
import { WorkChainService } from "../../modules/domain/decisions/work-chain.service"
import {
    INBOUND_EVENT_STATUS,
    MODULE_CATALOG_SOURCE,
    OUTBOUND_ACCESS_GATE,
    WORK_AGENT_DIRECTORY,
    WORK_ASK_CARDS,
} from "../../modules/domain/decisions/work-engine.decorators"
import { WorkBranchService } from "../../modules/domain/decisions/work-branch.service"
import { WorkIntakeService } from "../../modules/domain/decisions/work-intake.service"
import { WorkItemClosedService } from "../../modules/domain/decisions/work-item-closed.service"
import { WORK_PERFORMER_REGISTRY } from "../../modules/domain/decisions/work-performer.port"
import { WorkPerformersService } from "../../modules/domain/decisions/work-performers.service"
import { WorkRecorderService } from "../../modules/domain/decisions/work-recorder.service"
import { PerformerKitService } from "../../modules/domain/work-performers/performer-kit.service"
import { TeamChatProofModule } from "./team-chat-proof.module"
import { queueOptions } from "./test-capabilities.options"
import { QUIET_INSTALLATIONS } from "./quiet-peers.options"
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
        return Promise.resolve().then(() => {
            throw new TestWorldError({ code: TestWorldErrorCode.AccountsUnread })
        })
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

@Injectable()
/** The public api proofs open no team chat room, so no approval card stands for a decision and the ask is said as a line. */
export class PublicApiProofAskCards implements WorkAskCards {
    cardRooms(): ReturnType<WorkAskCards["cardRooms"]> {
        return Promise.resolve(0)
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

@Module({})
class PublicApiProofPeersModule {
    static register(): DynamicModule {
        const services = [
            ApiKeysService,
            ApiKnowledgeSourcesService,
            DataRecordsReadService,
            AuthorityService,
            CommandPlannerService,
            DurableWorkService,
            EvidenceService,
            InboundEventsService,
            ModuleCatalogService,
            SourceQuotaService,
            OfficeLinesService,
            PublicApiProofDirectory,
            PublicApiProofAccess,
            PublicApiProofAskCards,
            PerformerKitService,
            WorkApprovalService,
            WorkBranchService,
            WorkChainService,
            WorkEngineService,
            WorkIntakeService,
            WorkItemClosedService,
            WorkLinesService,
            WorkItemsService,
            WorkItemsChainReadService,
            InstallationRecordsService,
            InstallationOperationsService,
            InvoicesLedgerService,
            WorkPerformersService,
            WorkRecorderService,
            AuthorityRulesService,
        ]
        return {
            module: PublicApiProofPeersModule,
            global: true,
            imports: [KnowledgeQueueModule.register({}), TeamChatProofModule.register()],
            providers: [
                ...services,
                // No proof installs a module, so no agent has an installation.
                QUIET_INSTALLATIONS,
                { provide: KNOWLEDGE_STORAGE, useClass: PublicApiProofStorage },
                { provide: AGENT_DIRECTORY, useExisting: PublicApiProofDirectory },
                { provide: AgentsService, useExisting: PublicApiProofDirectory },
                { provide: INBOX, useClass: InboxService },
                { provide: INBOUND_EVENT_STATUS, useClass: PublicApiProofInbound },
                { provide: MODULE_CATALOG_SOURCE, useExisting: ModulesService },
                { provide: OUTBOUND_ACCESS_GATE, useExisting: PublicApiProofAccess },
                { provide: WORK_AGENT_DIRECTORY, useExisting: PublicApiProofDirectory },
                { provide: WORK_ASK_CARDS, useExisting: PublicApiProofAskCards },
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
            exports: [...services, AGENTS_INSTALLATIONS],
        }
    }
}

/** Real queue, ledger, inbox and work owners; only external ports are supplied by the proof. */
export const publicApiProofModules = (options: QueueOptions): Array<DynamicModule> => [
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
    EntityEngineModule.register({
        isGlobal: true,
        alerts: ReadOnlyEngineAlertsService,
        entities: FLOW_F_ENTITIES,
        jobs: MODULE_JOBS,
        cursorKey: PUBLIC_API_PROOF_TOKEN_KEY,
    }),
    ChatRecordsModule.register({ isGlobal: true }),
    ConnectionSecretsModule.register({ isGlobal: true, tokenKey: PUBLIC_API_PROOF_TOKEN_KEY }),
    ConnectionsModule.register({
        isGlobal: true,
        channelTokenKey: PUBLIC_API_PROOF_TOKEN_KEY,
        siteUrl: "http://localhost",
        publicSiteUrl: undefined,
    }),
    StaffModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true, accounts: PublicApiProofDirectory }),
    WorkspacesModule.register({ isGlobal: true, allowFreeWorkspace: false }),
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
export const PUBLIC_API_PROOF_MODULES: Array<DynamicModule> = publicApiProofModules({
    ...queueOptions,
    shutdownGraceMs: 0,
})
