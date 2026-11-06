import { Injectable } from "@nestjs/common"
import { AgentToolsService } from "@modules/domain/agent-tools"
import type { CustomerTurn } from "@modules/domain/conversations"
import type { KnowledgeSources } from "./gateway-turns.contracts"
import { TurnSourcesService } from "./turn-sources.service"

@Injectable()
/**
 * The tools of one customer turn: the knowledge the turn read, kept for the cards its tool calls open, and the end of it (with the
 * turn's tool token, when one was minted) when the turn ends.
 */
export class TurnToolAccessService {
    constructor(
        private readonly tools: AgentToolsService,
        private readonly sources: TurnSourcesService,
    ) {}

    /** Keeps the knowledge the turn read for the cards its tool calls open. */
    keep(turn: CustomerTurn, sources: KnowledgeSources): void {
        this.sources.keep(turn.messageId, sources)
    }

    /** Ends the turn's tools: the token is revoked and the kept knowledge forgotten. */
    close(turn: CustomerTurn): void {
        this.tools.revoke(turn.messageId)
        this.sources.drop(turn.messageId)
    }
}
