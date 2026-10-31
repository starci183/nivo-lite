import { Injectable } from "@nestjs/common"
import { AgentTurnsService, AgentWorkSettingsService } from "@modules/domain/agent-work"
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
 * come from the database, and nothing the model sent can set them. No running turn, no call. The session key of a turn carries its agent
 * (the drain adds it), so two agents that share a runtime agent never match each other's turn; a key that still names more than one
 * running turn matches none. A call is refused once work was switched off for the agent or its workspace, since a running turn may
 * finish its model call but must not act any more.
 */
export class AgentTurnAccessService implements BridgeTurns {
    constructor(
        @InjectAgentTurnsOptions() private readonly options: AgentTurnsOptions,
        @InjectClock() private readonly clock: Clock,
        private readonly turns: AgentTurnsService,
        private readonly settings: AgentWorkSettingsService,
    ) {}

    /** The running turn a signed credential names; null for a wrong secret, an expired or forged credential, a foreign session or no running turn. */
    async admit(token: string): Promise<OptionalBridgeTurn> {
        const { bridgeSecret } = this.options
        if (bridgeSecret === null) return null
        const claims = verifyBridgeToken(bridgeSecret.reveal(), token, Math.floor(this.clock.now().getTime() / 1000))
        return claims === null ? null : this.resolve(claims.agentId, claims.sessionKey)
    }

    /** The one turn running on this runtime agent and session, or null: none, several, or one whose work was switched off. */
    async resolve(runtimeAgentId: string, threadKey: string): Promise<OptionalBridgeTurn> {
        const running = await this.turns.runningOn(runtimeAgentId)
        const matching = running.filter((candidate) => sameSession(candidate.threadKey, threadKey))
        const [turn] = matching
        if (turn === undefined || matching.length > 1) return null
        return (await this.switchedOn(turn)) ? toBridgeTurn(turn) : null
    }

    private async switchedOn(turn: AgentRunningTurn): Promise<boolean> {
        const [state, settings] = await Promise.all([
            this.settings.stateOf(turn.agentId),
            this.settings.settingsOf(turn.workspaceId),
        ])
        return state.workEnabled && settings.workEnabled
    }
}
