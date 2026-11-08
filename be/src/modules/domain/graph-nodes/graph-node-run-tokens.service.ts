import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectIds, type Ids } from "@modules/platform/ids"
import type { NodeTurn } from "./graph-nodes.contracts"
import type { OptionalRunClaims } from "./node-run-token.contracts"
import { signRunToken, verifyRunToken } from "./node-run-token.policy"

/** How long a run token is valid: one node step, with room for a slow provider. */
const TOKEN_TTL_MS = 5 * 60_000

@Injectable()
/**
 * The short-lived run tokens of the node host: the host mints one for each tool call of a run (workspace, agent, run, conversation, who
 * the run acts for, what it may read, expiry) and the NIVO MCP door accepts a call only with a valid one, so who calls is what the host
 * knows, never what a node or a model says. The key is drawn when the app starts and never leaves the process: a token is honoured only
 * by the process that minted it, which is where the host and the door run.
 */
export class GraphNodeRunTokensService {
    private readonly key: Buffer

    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectIds() ids: Ids,
    ) {
        this.key = createHash("sha256").update(`${ids.next()}:${ids.next()}`).digest()
    }

    /** A token for a call of the turn's run, valid for one step. */
    mint(turn: NodeTurn): string {
        const origin = turn.origin ?? "system"
        return signRunToken(this.key, {
            workspaceId: turn.workspaceId,
            agentId: turn.agentId,
            runId: turn.turnId,
            conversationId: turn.conversationId,
            origin,
            memberId: turn.memberId ?? null,
            scope: origin === "customer" ? "public" : "workspace",
            expiresAt: this.clock.now().getTime() + TOKEN_TTL_MS,
        })
    }

    /** The claims of a token this process minted and that has not expired; null otherwise. */
    verify(token: string): OptionalRunClaims {
        return verifyRunToken(this.key, token, this.clock.now().getTime())
    }
}
