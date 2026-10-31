import { Injectable } from "@nestjs/common"
import { stoppedBy } from "@modules/domain/agent-turns"
import { KnowledgeRecallService, ModuleProfilesService, viewOf } from "@modules/domain/agent-knowledge"
import { InjectInstallations, replyTimeoutSec } from "@modules/domain/agents"
import type { Installation, InstallationDirectory } from "@modules/domain/agents"
import { UsageGateService } from "@modules/domain/ai-usage-events"
import { AuthorityService } from "@modules/domain/authority"
import type { CustomerTurn, ChatTurnProposal, ChatTurnRuntime, RuntimeAnswer } from "@modules/domain/conversations"
import { HiringPublicService } from "@modules/domain/hiring"
import { ModuleReadinessService } from "@modules/domain/modules"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { authorityBrief } from "@modules/domain/ai-tasks"
import { InjectOpenclawAgentRegistry, InjectOpenclawGateway } from "@modules/integrations/openclaw"
import type { AgentRegistryService, GatewayClient } from "@modules/integrations/openclaw"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CustomerTurnGatewayService } from "./customer-turn-gateway.service"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import type { InstallationOrReason, TurnSystem } from "./customer-turns.contracts"
import { GatewayContextService } from "./gateway-context.service"
import { recallSourcesOf } from "./knowledge-sources.policy"
import { detailOf, readCustomerReply } from "./reply-reading.policy"
import { TurnModulesService } from "./turn-modules.service"
import { TurnToolAccessService } from "./turn-tool-access.service"
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
/** Why a turn of an agent holding connector grants does not run: no tool token can be minted (no tool secret). */
const TOOLS_NOT_CONFIGURED = "tools_not_configured"
/** What separates the tool block from the rest of the system text. */
const BLOCK_SEPARATOR = "\n\n"

@Injectable()
/**
 * The AI step of a customer turn: OpenClaw is the only text AI. The turn runs on the workspace's own agent for the module (its synced
 * workspace holds the rules, knowledge files and tone), in the thread of the NIVO conversation, with the authoritative context every
 * turn: the persona, the owner's authority, the knowledge recalled for the question (PUBLIC only), the open jobs, and the reply
 * contract. The answer is only a PROPOSAL: the outcome handler puts it through the gate. A missing gateway, a used-up allowance, an
 * installation that is not ready or live (its required connections missing) or a failed turn answers the reason instead, and the
 * customer gets the holding line. Each turn mints its own tool token (job = the inbound message) and gives it to the agent in the
 * [OPTIONAL TOOLS] block of the message it sends; the token is never stored or logged and is revoked when the turn ends, however it
 * ends. An agent holding connector grants does not run without one (`tools_not_configured`): it would answer without its tools.
 *
 * The core road shares three of its parts: the installation gate (`installationOf`), the authoritative context (`systemOf`) and the
 * reading of the model's text as a proposal (`proposalFrom`); the plan of the turn there is made by `CustomerCorePlanService`.
 */
export class CustomerTurnRuntimeService implements ChatTurnRuntime {
    private readonly turnGateway: CustomerTurnGatewayService

    constructor(
        @InjectOpenclawGateway() gateway: GatewayClient,
        @InjectOpenclawAgentRegistry() registry: AgentRegistryService,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        sync: AgentSyncService,
        private readonly usage: UsageGateService,
        private readonly authority: AuthorityService,
        private readonly recall: KnowledgeRecallService,
        private readonly hiring: HiringPublicService,
        private readonly profiles: ModuleProfilesService,
        private readonly modules: TurnModulesService,
        private readonly readiness: ModuleReadinessService,
        private readonly connectors: GatewayContextService,
        private readonly access: TurnToolAccessService,
    ) {
        this.turnGateway = new CustomerTurnGatewayService(gateway, registry, sync, this.logger)
    }

    /** Proposes the reply of one turn, or answers why it could not. */
    async propose(turn: CustomerTurn): Promise<RuntimeAnswer> {
        const { conversation } = turn
        const workspaceId = conversation.workspaceId
        if (!this.turnGateway.configured()) return NOT_CONFIGURED
        if ((await this.usage.blockedBy(workspaceId, USAGE_KIND, LOCALE)) !== null) return QUOTA
        const installation = await this.installationOf(workspaceId, conversation.agent.id)
        if (typeof installation === "string") return installation
        const timeoutMs = replyTimeoutSec(installation?.settings ?? null) * 1000
        const token = this.access.open(turn, timeoutMs)
        const answered = await this.guarded(turn, installation, timeoutMs, token)
        this.access.close(turn)
        return answered
    }

    /** The installation of the agent when it runs, or null when the agent has none; otherwise why it does not answer. */
    async installationOf(workspaceId: string, agentId: string): Promise<InstallationOrReason> {
        const installation = await this.installations.ofAgent(workspaceId, agentId)
        const status = installation === null ? null : await this.readiness.settle(workspaceId, installation.id)
        // Only a running agent answers: switched on by the owner and holding an applied version.
        return stoppedBy(status, installation) ?? installation
    }

    /** The turn's answer, or the reason it has none; it never throws, so the token is revoked however the turn ends. */
    private async guarded(
        turn: CustomerTurn,
        installation: Installation | null,
        timeoutMs: number,
        token: string,
    ): Promise<RuntimeAnswer> {
        try {
            if (token === "" && (await this.connectors.servesConnectors(turn.conversation))) return TOOLS_NOT_CONFIGURED
            return await this.answer(turn, installation, timeoutMs, token)
        } catch (cause) {
            this.logger.error(CustomerTurnsLogEvent.TurnFailed, cause, { conversationId: turn.conversation.id })
            return UNAVAILABLE
        }
    }

    /** Runs the turn on the agent with its context, its knowledge kept for its tool calls, and meters it. */
    private async answer(
        turn: CustomerTurn,
        installation: Installation | null,
        timeoutMs: number,
        token: string,
    ): Promise<ChatTurnProposal> {
        const { conversation } = turn
        const workspaceId = conversation.workspaceId
        const agentId = await this.turnGateway.agentFor(workspaceId, conversation.agent.module, installation)
        const system = await this.systemOf(turn)
        this.access.keep(turn, system.sources)
        const text = [system.text, this.access.blockOf(token)].filter((part) => part !== "").join(BLOCK_SEPARATOR)
        const message = turnMessageOf(text, turn.transcript, turn.body)
        const result = await this.turnGateway.run(turn, conversation, agentId, message, timeoutMs)
        await this.usage.record({
            workspaceId,
            kind: USAGE_KIND,
            module: conversation.agent.module,
            usage: result.usage,
            completionChars: result.text.length,
        })
        return this.proposalFrom(result.text)
    }

    /** Reads the model's text as the proposal of a customer turn: a reply that ignored the contract becomes a question for a person. */
    proposalFrom(text: string): ChatTurnProposal {
        const reply = readCustomerReply(text, this.catalog.get("conversations.holdingReply", {}, LOCALE))
        return {
            reply: reply.reply,
            needsHuman: reply.needsHuman,
            reason: reply.reason ?? "",
            proposedAnswer: reply.proposedAnswer ?? "",
            detail: detailOf(reply),
        }
    }

    /** The authoritative context of the turn; a block that cannot be read is left out, never the turn. */
    async systemOf(turn: CustomerTurn): Promise<TurnSystem> {
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
        const text = turnSystemOf({
            persona: personaOf(conversation.agent),
            authority,
            recall: recalled.brief,
            extras: [jobs, ...modules],
            contract: this.contractOf(conversation.agent.module),
        })
        return { text, sources: recallSourcesOf(recalled.facts, recalled.passages) }
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
