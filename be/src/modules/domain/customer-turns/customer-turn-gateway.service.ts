import type { Installation } from "@modules/domain/agents"
import type { CustomerTurn } from "@modules/domain/conversations"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import {
    InjectOpenclawAgentRegistry,
    InjectOpenclawGateway,
    agentIdFor,
    threadKeyFor,
} from "@modules/integrations/openclaw"
import type { AgentRegistryService, GatewayClient, TurnResult } from "@modules/integrations/openclaw"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"

/** The socket gets a little longer than the turn, so the gateway's own timeout answers first. */
const ABORT_GRACE_MS = 5000

/** Selects the customer's agent and sends the prepared turn through its OpenClaw thread. */
export class CustomerTurnGatewayService {
    /** Captures the existing gateway, agent sync, clock and logging ports without running a turn. */
    constructor(
        @InjectOpenclawGateway() private readonly gateway: GatewayClient,
        @InjectOpenclawAgentRegistry() private readonly registry: AgentRegistryService,
        private readonly sync: AgentSyncService,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Whether the gateway is configured now. */
    configured(): boolean {
        return this.gateway.enabled
    }

    /**
     * The module's own agent when OpenClaw already knows it; otherwise its copy is built now. When that cannot be done,
     * the turn runs on the workspace's internal agent with the complete context prepared by the runtime.
     */
    async agentFor(workspaceId: string, module: string, installation: Installation | null): Promise<string> {
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

    /** Runs the prepared message with the conversation thread, current idempotency instant and unchanged abort grace. */
    run(
        turn: CustomerTurn,
        conversation: CustomerTurn["conversation"],
        agentId: string,
        message: string,
        timeoutMs: number,
    ): Promise<TurnResult> {
        return this.gateway.runTurn(
            {
                agentId,
                threadKey: threadKeyFor(agentId, conversation.id),
                message,
                idempotencyKey: `chat-${turn.messageId}-${this.clock.now().getTime()}`,
                timeoutMs,
            },
            AbortSignal.timeout(timeoutMs + ABORT_GRACE_MS),
        )
    }
}
