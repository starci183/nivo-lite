import { Injectable, Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { AgentBindingsService, AgentConnectionsModule } from "@modules/domain/agent-connections"
import { AiUsageEventsModule } from "@modules/domain/ai-usage-events"
import { BankFeedInboxModule } from "@modules/domain/bank-feed-inbox"
import { BillingModule } from "@modules/domain/billing"
import { ChannelConnectionsModule } from "@modules/domain/channel-connections"
import { ChatActivityModule } from "@modules/domain/chat-activity"
import { ChatFilesModule } from "@modules/domain/chat-files"
import { ConnectionSecretsModule } from "@modules/domain/connection-secrets"
import { ConnectionsModule } from "@modules/domain/connections"
import { InboundEventsModule } from "@modules/domain/inbound-events"
import { MessagesModule } from "@modules/domain/messages"
import type { AgentDirectory } from "@modules/domain/messages"
import { OfficeTagService } from "@modules/domain/office-command-candidates"
import { PaymentOrdersModule } from "@modules/domain/payment-orders"
import { TransactionsModule } from "@modules/domain/transactions"
import { AiModule } from "@modules/integrations/ai"
import { ChannelSetupModule } from "@modules/integrations/channel-setup"
import { DocumentsModule } from "@modules/integrations/documents"
import { ObjectStorageModule, STORAGE_OBJECTS } from "@modules/integrations/object-storage"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { HttpError, HttpErrorCode } from "@modules/platform/http"
import { HttpSecurityModule } from "@modules/platform/http-security"
import { JobsModule } from "@modules/platform/jobs"
import { AGENT_WORK_MODULES } from "./agent-work-capabilities.options"

/** Synthetic credentials for the proof's real integrations; no deployed account is used. */
const TAG_PROVIDER_KEY = new Secret(Buffer.alloc(32, 17).toString("base64"))

/** File parsing is outside this text-only tag proof, so an unexpected read must fail. */
const refuseFileRead = (): never => {
    throw new HttpError({ code: HttpErrorCode.Network })
}

@Injectable()
/** Which agent speaks in the Office, read from the agent directory: a line that names its agent is spoken by it, and no department speaks. */
export class ProofAgentDirectory implements AgentDirectory {
    constructor(private readonly agents: AgentDirectoryService) {}

    agentOfDepartment(): ReturnType<AgentDirectory["agentOfDepartment"]> {
        return Promise.resolve(null)
    }

    async agentById(workspaceId: string, agentId: string): ReturnType<AgentDirectory["agentById"]> {
        const agent = await this.agents.headOf(workspaceId, agentId)
        return agent === null ? null : { id: agent.id, name: agent.name }
    }
}

@Module({})
class AgentTagProofModule {
    /** The Office tag door and what it stands on, bound the way the api composes them. */
    static register(): DynamicModule {
        return {
            module: AgentTagProofModule,
            global: true,
            providers: [ProofAgentDirectory, AgentDirectoryService, OfficeTagService],
            exports: [ProofAgentDirectory, AgentDirectoryService, OfficeTagService],
        }
    }
}

/** The agent work store with the Office on top: lines, activity pushes and the tag door, with the scripted handler and executor. */
export const AGENT_TAG_MODULES: Array<DynamicModule> = [
    ...AGENT_WORK_MODULES,
    JobsModule.register({
        isGlobal: true,
        connection: PRIMARY_ENTITY_MANAGER,
        workerId: "agent-tag-proof",
        leaseMs: 100,
        scheduler: { enabled: false },
    }),
    HttpSecurityModule.register({
        isGlobal: true,
        trustedProxyHops: 0,
        allowedOrigins: [],
        rateLimit: { windowMs: 60000, defaultLimit: 100, strictLimit: 10 },
        webhooks: {},
    }),
    AiModule.register({
        isGlobal: true,
        gatewayUrl: null,
        virtualKey: null,
        chatModel: "tag-proof",
        embeddingModel: "tag-proof",
    }),
    DocumentsModule.register({
        isGlobal: true,
        driveBase: "https://drive.invalid",
        oauthBase: null,
        google: null,
        readers: { docx: refuseFileRead, pdf: refuseFileRead, pdfPages: refuseFileRead },
    }),
    ObjectStorageModule.register({
        isGlobal: true,
        endpoint: "https://storage.invalid:9000",
        region: "us-east-1",
        accessKey: new Secret("agent-tag-proof"),
        secretKey: new Secret("agent-tag-proof"),
        bucketPrefix: "agent-tag-proof",
        publicUrl: "https://storage.invalid:9000",
        timeoutMs: 1000,
    }),
    ChannelSetupModule.register({ isGlobal: true, zaloOauthBase: undefined, siteUrl: undefined, timeoutMs: 1000 }),
    ConnectionSecretsModule.register({ isGlobal: true, tokenKey: TAG_PROVIDER_KEY }),
    ConnectionsModule.register({
        isGlobal: true,
        channelTokenKey: TAG_PROVIDER_KEY,
        siteUrl: "https://site.invalid",
        publicSiteUrl: undefined,
        ports: { agents: AgentBindingsService },
    }),
    AgentConnectionsModule.register({ isGlobal: true, ports: { agents: AgentDirectoryService } }),
    ChannelConnectionsModule.register({ isGlobal: true }),
    PaymentOrdersModule.register({ isGlobal: true }),
    BankFeedInboxModule.register({ isGlobal: true }),
    InboundEventsModule.register({ isGlobal: true }),
    TransactionsModule.register({ isGlobal: true }),
    BillingModule.register({
        isGlobal: true,
        sepayApiKey: undefined,
        bankAccount: { account: "", bank: "", holder: "" },
    }),
    AiUsageEventsModule.register({ isGlobal: true }),
    ChatFilesModule.register({ isGlobal: true, storage: STORAGE_OBJECTS }),
    ChatActivityModule.register({ isGlobal: true }),
    AgentTagProofModule.register(),
    MessagesModule.register({ isGlobal: true, agentDirectory: ProofAgentDirectory }),
]
