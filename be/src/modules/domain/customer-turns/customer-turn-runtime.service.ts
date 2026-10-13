import { Injectable } from "@nestjs/common"
import { KnowledgeRecallService, ModuleProfilesService, viewOf } from "@modules/domain/agent-knowledge"
import { InjectInstallations, replyTimeoutSec } from "@modules/domain/agents"
import type { Installation, InstallationDirectory } from "@modules/domain/agents"
import { UsageGateService } from "@modules/domain/ai-usage-events"
import { AuthorityService } from "@modules/domain/authority"
import type { CustomerTurn, ChatTurnProposal, ChatTurnRuntime, RuntimeAnswer } from "@modules/domain/conversations"
import { HiringPublicService } from "@modules/domain/hiring"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { authorityBrief } from "@modules/integrations/deepseek"
import {
    InjectOpenclawAgentRegistry,
    InjectOpenclawGateway,
    agentIdFor,
    threadKeyFor,
} from "@modules/integrations/openclaw"
import type { AgentRegistryService, GatewayClient } from "@modules/integrations/openclaw"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import { detailOf, readCustomerReply } from "./reply-reading.policy"
import { TurnModulesService } from "./turn-modules.service"
import { personaOf, turnMessageOf, turnSystemOf } from "./turn-prompt.policy"

/** The language the context and the fixed lines of a turn are written in. */
const LOCALE: Locale = "vi"
/** The usage kind a customer reply is metered under. */
const USAGE_KIND = "chat_reply"
/** Why a turn falls back when no gateway is configured. */
const NOT_CONFIGURED = "openclaw_not_configured"
/** Why a turn falls back when the plan allowance is used up. */
const QUOTA = "quota_exceeded"
/** Why a turn falls back when the gateway failed or was too slow. */
const UNAVAILABLE = "openclaw_unavailable"
/** The socket gets a little longer than the turn, so the gateway's own timeout answers first. */
const ABORT_GRACE_MS = 5000

@Injectable()
/**
 * The AI step of a customer turn: OpenClaw is the only text AI. The turn runs on the workspace's own agent for the module (its synced
 * workspace holds the rules, knowledge files and tone), in the thread of the NIVO conversation, with the authoritative context every
 * turn: the persona, the owner's authority, the knowledge recalled for the question (PUBLIC only), the open jobs, and the reply
 * contract. The answer is only a PROPOSAL: the outcome handler puts it through the gate. A missing gateway, a used-up allowance or a
 * failed turn answers the reason instead, and the customer gets the holding line.
 */
export class CustomerTurnRuntimeService implements ChatTurnRuntime {
    constructor(
        @InjectOpenclawGateway() private readonly gateway: GatewayClient,
        @InjectOpenclawAgentRegistry() private readonly registry: AgentRegistryService,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly sync: AgentSyncService,
        private readonly usage: UsageGateService,
        private readonly authority: AuthorityService,
        private readonly recall: KnowledgeRecallService,
        private readonly hiring: HiringPublicService,
        private readonly profiles: ModuleProfilesService,
        private readonly modules: TurnModulesService,
    ) {}

    /** Proposes the reply of one turn, or answers why it could not. */
    async propose(turn: CustomerTurn): Promise<RuntimeAnswer> {
        const { conversation } = turn
        const workspaceId = conversation.workspaceId
        if (!this.gateway.enabled) return NOT_CONFIGURED
        if ((await this.usage.blockedBy(workspaceId, USAGE_KIND, LOCALE)) !== null) return QUOTA
        const installation = await this.installations.ofAgent(workspaceId, conversation.agent.id)
        const timeoutMs = replyTimeoutSec(installation?.settings ?? null) * 1000
        try {
            const agentId = await this.agentFor(workspaceId, conversation.agent.module, installation)
            const message = turnMessageOf(await this.systemOf(turn), turn.transcript, turn.body)
            const result = await this.gateway.runTurn(
                {
                    agentId,
                    threadKey: threadKeyFor(agentId, conversation.id),
                    message,
                    idempotencyKey: `chat-${turn.messageId}-${this.clock.now().getTime()}`,
                    timeoutMs,
                },
                AbortSignal.timeout(timeoutMs + ABORT_GRACE_MS),
            )
            await this.usage.record({
                workspaceId,
                kind: USAGE_KIND,
                module: conversation.agent.module,
                usage: result.usage,
                completionChars: result.text.length,
            })
            return this.proposalOf(result.text)
        } catch (cause) {
            this.logger.error(CustomerTurnsLogEvent.TurnFailed, cause, { conversationId: conversation.id })
            return UNAVAILABLE
        }
    }

    private proposalOf(text: string): ChatTurnProposal {
        const reply = readCustomerReply(text, this.catalog.get("conversations.holdingReply", {}, LOCALE))
        return {
            reply: reply.reply,
            needsHuman: reply.needsHuman,
            reason: reply.reason ?? "",
            proposedAnswer: reply.proposedAnswer ?? "",
            detail: detailOf(reply),
        }
    }

    /**
     * The module's own agent when OpenClaw already knows it; otherwise its copy is built now (first turn after an install, a fresh
     * gateway). When that cannot be done the turn runs on the workspace's internal agent: the context of every turn is complete anyway.
     */
    private async agentFor(workspaceId: string, module: string, installation: Installation | null): Promise<string> {
        const own = agentIdFor(workspaceId, module)
        if (this.registry.has(own)) return own
        if (installation !== null) {
            try {
                const synced = await this.sync.syncInstallation(workspaceId, installation.id, true)
                if (synced !== null) return synced.agentId
            } catch (cause) {
                this.logger.error(CustomerTurnsLogEvent.AgentSyncFailed, cause, { installationId: installation.id })
            }
        }
        return this.sync.ensureInternalAgent(workspaceId)
    }

    /** The authoritative context of the turn; a block that cannot be read is left out, never the turn. */
    private async systemOf(turn: CustomerTurn): Promise<string> {
        const { conversation } = turn
        const workspaceId = conversation.workspaceId
        const view = viewOf({
            workspaceId,
            module: conversation.agent.module,
            audience: "customer",
            installationId: conversation.installationId,
        })
        const [authority, recalled, jobs, modules] = await Promise.all([
            this.authority
                .load({ workspaceId })
                .then(authorityBrief)
                .catch((cause: unknown) => this.skip(cause, workspaceId, "authority")),
            this.recall.recall(view, turn.body),
            this.hiring.chatBrief(workspaceId).catch((cause: unknown) => this.skip(cause, workspaceId, "hiring")),
            this.modules
                .briefs(conversation)
                .catch((cause: unknown): ReadonlyArray<string> => [this.skip(cause, workspaceId, "modules")]),
        ])
        return turnSystemOf({
            persona: personaOf(conversation.agent),
            authority,
            recall: recalled.brief,
            extras: [jobs, ...modules],
            contract: this.contractOf(conversation.agent.module),
        })
    }

    /** The module's reply contract; a module with none of its own answers a customer under the base contract. */
    private contractOf(module: string): string {
        const base = this.catalog.get(
            "bundle.replyContract",
            {
                applicationClause: this.profiles.applicationClause(),
                applicationShape: this.profiles.applicationShape(),
            },
            LOCALE,
        )
        return this.profiles.replyContractOf(module, base) ?? base
    }

    private skip(cause: unknown, workspaceId: string, part: string): string {
        this.logger.error(CustomerTurnsLogEvent.ContextPartFailed, cause, { workspaceId, part })
        return ""
    }
}
