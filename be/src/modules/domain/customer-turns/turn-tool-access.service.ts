import { Injectable } from "@nestjs/common"
import { AgentToolsService } from "@modules/domain/agent-tools"
import type { CustomerTurn } from "@modules/domain/conversations"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectCustomerTurnsOptions } from "./customer-turns.decorators"
import type { CustomerTurnsOptions } from "./customer-turns.options"
import type { KnowledgeSources } from "./gateway-turns.contracts"
import { TurnSourcesService } from "./turn-sources.service"

const LOCALE = "vi"
/** How long a turn's tool token outlives the turn's own time limit, in seconds. */
const TOKEN_GRACE_SEC = 30

@Injectable()
/**
 * The tools of one customer turn: its own short-lived tool token (job = the inbound message, scoped to the workspace and the
 * conversation), the [OPTIONAL TOOLS] block that hands the token to the agent in the message it receives, the knowledge the turn read
 * kept for the cards its tool calls open, and the end of all three when the turn ends. The token only ever travels in that block: it
 * is never stored, logged or audited, and an empty token (no tool secret) gives no block.
 */
export class TurnToolAccessService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectCustomerTurnsOptions() private readonly options: CustomerTurnsOptions,
        private readonly tools: AgentToolsService,
        private readonly sources: TurnSourcesService,
    ) {}

    /** Mints the turn's token, valid for the turn's time limit plus a grace; empty when the bridge has no secret. */
    open(turn: CustomerTurn, timeoutMs: number): string {
        const { conversation } = turn
        return this.tools.issue(
            { jobId: turn.messageId, workspaceId: conversation.workspaceId, conversationId: conversation.id },
            Math.ceil(timeoutMs / 1000) + TOKEN_GRACE_SEC,
        )
    }

    /** Keeps the knowledge the turn read for the cards its tool calls open. */
    keep(turn: CustomerTurn, sources: KnowledgeSources): void {
        this.sources.keep(turn.messageId, sources)
    }

    /** Where and with which token the agent calls NIVO's tools this turn; nothing without a token. */
    blockOf(token: string): string {
        if (token === "") return ""
        return this.catalog.get("customerTurns.toolsBlock", { url: this.options.toolsBaseUrl, token }, LOCALE)
    }

    /** Ends the turn's tools: the token is revoked and the kept knowledge forgotten. */
    close(turn: CustomerTurn): void {
        this.tools.revoke(turn.messageId)
        this.sources.drop(turn.messageId)
    }
}
