import { Injectable } from "@nestjs/common"
import { AgentTurnsService } from "@modules/domain/agent-work"
import type { AgentRunningTurn } from "@modules/domain/agent-work"
import type { BridgeTurn, BridgeTurns, OptionalBridgeTurn } from "@modules/domain/agent-tools"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectAgentTurnsOptions } from "./agent-turns.decorators"
import { sameSession, verifyBridgeToken } from "./bridge-credential.policy"
import type { AgentTurnsOptions } from "./agent-turns.options"

const toBridgeTurn = (turn: AgentRunningTurn): BridgeTurn => ({
    // A customer turn keeps the key its tool token had (the message), so what the turn kept for its cards is found again.
    jobId: turn.source === "customer" ? (turn.context.messageId ?? turn.wakeId) : turn.wakeId,
    workspaceId: turn.workspaceId,
    agentId: turn.agentId,
    turnId: turn.turnId,
    wakeId: turn.wakeId,
    source: turn.source,
    conversationId: turn.context.conversationId ?? null,
    authorUserId: turn.context.authorUserId ?? null,
})

@Injectable()
/**
 * Who a call of the OpenClaw bridge plugin is for. The plugin signs the agent and session OpenClaw gave its tool; this finds the one turn
 * running on that session and builds the context of the call from the turn's own wake: the workspace, the agent and the conversation
 * come from the database, and nothing the model sent can set them. No running turn, no call; the one-turn lock per scope makes the
 * match exact.
 */
export class AgentTurnAccessService implements BridgeTurns {
    constructor(
        @InjectAgentTurnsOptions() private readonly options: AgentTurnsOptions,
        @InjectClock() private readonly clock: Clock,
        private readonly turns: AgentTurnsService,
    ) {}

    /** The running turn a signed credential names; null for a wrong secret, an expired or forged credential, a foreign session or no running turn. */
    async admit(token: string): Promise<OptionalBridgeTurn> {
        const { bridgeSecret } = this.options
        if (bridgeSecret === null) return null
        const claims = verifyBridgeToken(bridgeSecret.reveal(), token, Math.floor(this.clock.now().getTime() / 1000))
        return claims === null ? null : this.resolve(claims.agentId, claims.sessionKey)
    }

    /** The turn running on this runtime agent and session, or null. */
    async resolve(runtimeAgentId: string, threadKey: string): Promise<OptionalBridgeTurn> {
        const running = await this.turns.runningOn(runtimeAgentId)
        const turn = running.find((candidate) => sameSession(candidate.threadKey, threadKey))
        return turn === undefined ? null : toBridgeTurn(turn)
    }
}
