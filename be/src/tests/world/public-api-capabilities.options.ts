import { ConnectionsModule } from "@modules/domain/connections"
import { ConnectionSecretsModule } from "@modules/domain/connection-secrets"
import { DataRecordsReadService } from "@modules/domain/data-records"
import { Injectable, Module, type DynamicModule } from "@nestjs/common"
import { ApiKeysService } from "@modules/domain/api-keys"
import { AgentConnectionsModule } from "@modules/domain/agent-connections"
import { AGENTS_INSTALLATIONS, AgentDirectoryService, AgentsModule, AgentsService } from "@modules/domain/agents"
import { chatRecordsModules } from "./chat-records-modules"
import { ChannelDeliveryService, type PersonDeliveryRequest } from "@modules/domain/channels"
import { ContactsModule } from "@modules/domain/contacts"
import { CustomerRoutesModule } from "@modules/domain/customer-routes"
import { EntityEngineModule, ReadOnlyEngineAlertsService } from "@modules/domain/entity-engine"
import { EventsModule } from "@modules/domain/events"
import { ApiKnowledgeSourcesService, SourceQuotaService } from "@modules/domain/knowledge-sources"
import { KNOWLEDGE_STORAGE } from "../../modules/domain/knowledge-sources/knowledge-sources.decorators"
import { MODULE_CATALOG, MODULE_CATEGORIES, ModulesModule } from "@modules/domain/modules"
import { PublicApiModule } from "@modules/domain/public-api"
import { StaffModule } from "@modules/domain/staff"
import { WorkspacesModule } from "@modules/domain/workspaces"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { refused } from "@modules/platform/primitives"
import { Secret } from "@modules/platform/config"
import { EVENT_BUS, type EventBus } from "@modules/platform/event-bus"
import { WebhookEventsService } from "@modules/domain/webhook-connections"
import { WorkspaceMembersModule, type AccountDirectory } from "@modules/domain/workspace-members"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { I18nModule } from "@modules/platform/i18n"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { IdsModule } from "@modules/platform/ids"
import { JobsModule } from "@modules/platform/jobs"
import { QueueModule, type QueueOptions } from "@modules/platform/queue"
import { KnowledgeQueueModule } from "@modules/queues/knowledge"
import { TeamChatProofModule } from "./team-chat-proof.module"
import { queueOptions } from "./test-capabilities.options"
import { QUIET_INSTALLATIONS } from "./quiet-peers.options"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import { INSTALLED } from "@modules/domain/installed-plugins"

@Injectable()
/** No agent or authentication account lookup is needed to admit an API request. */
export class PublicApiProofDirectory implements AccountDirectory {
    agentOfDepartment(): Promise<null> {
        return Promise.resolve(null)
    }

    accountOf(): ReturnType<AccountDirectory["accountOf"]> {
        return Promise.reject(new TestWorldError({ code: TestWorldErrorCode.AccountsUnread }))
    }
}

/** One delivery the processing asked the channel for, as the proof records it. */
export interface ProofDelivery {
    readonly workspaceId: string
    readonly conversationId: string
    readonly messageId: string
    readonly text: string
}

@Injectable()
/** The channel of the proofs: records each delivery asked of it and answers that the channel took it; no network. */
export class PublicApiProofDelivery {
    readonly delivered: Array<ProofDelivery> = []

    /** The sends addressed to a person on a route, as the public API's delivery makes them (the delivery ledger claims each key before it is asked). */
    readonly toPerson: Array<PersonDeliveryRequest> = []

    deliverToPerson(request: PersonDeliveryRequest): ReturnType<ChannelDeliveryService["deliverToPerson"]> {
        this.toPerson.push(request)
        return Promise.resolve({ delivered: true, failure: null, outcome: "acknowledged" })
    }

    deliver(request: ProofDelivery): ReturnType<ChannelDeliveryService["deliver"]> {
        this.delivered.push(request)
        return Promise.resolve({ delivered: true, failure: null, outcome: "acknowledged" })
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
            SourceQuotaService,
            PublicApiProofDirectory,
            PublicApiProofDelivery,
            InstallationRecordsService,
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
                { provide: AgentsService, useExisting: PublicApiProofDirectory },
                { provide: INBOX, useClass: InboxService },
                { provide: ChannelDeliveryService, useExisting: PublicApiProofDelivery },
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
    AgentsModule.register({ isGlobal: true, directoryOnly: true }),
    EntityEngineModule.register({
        isGlobal: true,
        alerts: ReadOnlyEngineAlertsService,
        entities: INSTALLED.entities(),
        jobs: INSTALLED.jobs(),
        cursorKey: PUBLIC_API_PROOF_TOKEN_KEY,
    }),
    AgentConnectionsModule.register({ isGlobal: true, ports: { agents: AgentDirectoryService } }),
    ...chatRecordsModules(),
    // The engine's contacts and routes: the conversation of the public API is a route, and its message is a row of the delivery ledger.
    ContactsModule.register({ isGlobal: true }),
    CustomerRoutesModule.register({ isGlobal: true }),
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
