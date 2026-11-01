import { runtimeAgentFor } from "@modules/domain/agent-turns"
import type { Installation } from "@modules/domain/agents"
import type { CustomerTurn } from "@modules/domain/conversations"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { InjectOpenclawAgentRegistry, InjectOpenclawGateway, threadKeyFor } from "@modules/integrations/openclaw"
import type { AgentRegistryService, GatewayClient, TurnAttachment, TurnResult } from "@modules/integrations/openclaw"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"

/** The socket gets a little longer than the turn, so the gateway's own timeout answers first. */
const ABORT_GRACE_MS = 5000

/** Selects the customer's agent and sends the prepared turn through its OpenClaw thread. */
export class CustomerTurnGatewayService {
    /** Captures the existing gateway, agent sync and logging ports without running a turn. */
    constructor(
        @InjectOpenclawGateway() private readonly gateway: GatewayClient,
        @InjectOpenclawAgentRegistry() private readonly registry: AgentRegistryService,
        private readonly sync: AgentSyncService,
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
    agentFor(workspaceId: string, module: string, installation: Installation | null): Promise<string> {
        return runtimeAgentFor(
            {
                registry: this.registry,
                sync: this.sync,
                logger: this.logger,
            },
            workspaceId,
            module,
            installation,
        )
    }

    /** Runs the prepared message with one stable replay key per customer message and unchanged abort grace. */
    run(
        turn: CustomerTurn,
        conversation: CustomerTurn["conversation"],
        agentId: string,
        message: string,
        timeoutMs: number,
        attachments: ReadonlyArray<TurnAttachment> = [],
    ): Promise<TurnResult> {
        return this.gateway.runTurn(
            {
                agentId,
                threadKey: threadKeyFor(agentId, conversation.id),
                message,
                attachments,
                idempotencyKey: `chat-${turn.messageId}`,
                timeoutMs,
            },
            AbortSignal.timeout(timeoutMs + ABORT_GRACE_MS),
        )
    }
}
