import { Injectable } from "@nestjs/common"
import { InjectOpenclawGateway } from "@modules/integrations/openclaw"
import type { GatewayClient } from "@modules/integrations/openclaw"
import { ABORT_GRACE_MS } from "./agent-turn.policy"
import type { AgentTurnRequest, AgentTurnResult } from "./agent-turns.contracts"
import type { AgentTurnRunner } from "./agent-turns.port"

@Injectable()
/** The one runner of a turn: it sends the message through the agent's OpenClaw session and answers the text and what the run cost. */
export class OpenClawTurnRunnerService implements AgentTurnRunner {
    constructor(@InjectOpenclawGateway() private readonly gateway: GatewayClient) {}

    /** Whether the gateway is configured now. */
    configured(): boolean {
        return this.gateway.enabled
    }

    /** Runs the turn; the replay key makes a retried send a no-op, and the socket outlives the turn by a grace so the gateway answers first. */
    async run(request: AgentTurnRequest, signal: AbortSignal): Promise<AgentTurnResult> {
        const result = await this.gateway.runTurn(
            {
                agentId: request.runtimeAgentId,
                threadKey: request.threadKey,
                message: request.message,
                ...(request.attachments === undefined ? {} : { attachments: request.attachments }),
                idempotencyKey: request.runKey,
                timeoutMs: request.timeoutMs,
            },
            AbortSignal.any([signal, AbortSignal.timeout(request.timeoutMs + ABORT_GRACE_MS)]),
        )
        return { text: result.text, usage: result.usage, runtimeAgentId: request.runtimeAgentId }
    }
}
