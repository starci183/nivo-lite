import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectIds, type Ids } from "@modules/platform/ids"
import type { NodeTurn } from "./graph-nodes.contracts"
import type { NodeRunClaims, NodeStepRef, OptionalRunClaims } from "./node-run-token.contracts"
import { signRunToken, verifyRunToken } from "./node-run-token.policy"

/**
 * The data kind of the sales module's lead, when a module's resolver made it the turn's subject: a BRIDGE read only by the run's pin of
 * module effects that still name a `leadId` argument, until that module reads its lead by the contact.
 */
export const LEAD_KIND = "sales-lead"

/** The sales lead a module resolved as the turn's subject, else null: the bridge of the effect pin (see `LEAD_KIND`). */
export const runLeadOf = (turn: NodeTurn): string | null => (turn.subject?.kind === LEAD_KIND ? turn.subject.id : null)

/** The contact (the engine's person) a run serves, else null. */
export const runContactOf = (turn: NodeTurn): string | null =>
    typeof turn.contactId === "string" && turn.contactId !== "" ? turn.contactId : null

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

    /**
     * A token for a call of the turn's run, valid for one step. Besides the claims every token carries it signs the contact the run is
     * about (`contactId`; and `leadId`, the sales lead a module resolved as the subject: the bridge of the module effects' pin), which
     * the door fills into a context read locked to the
     * run's own customer. It signs no step allow-list (`stepTools`) and no language: a gateway call made with it is no graph step of the
     * gateway's (`runOfClaims` stays undefined), so no NIVO effect runs through the gateway and the host's ledger stays the only one.
     * `step` is the workflow step the call is made in, when the host runs a node of a pinned version: it is signed as given and names
     * where the call came from; a token minted without one carries none.
     */
    mint(turn: NodeTurn, step?: NodeStepRef): string {
        const origin = turn.origin ?? "system"
        const claims: NodeRunClaims & { readonly contactId: string | null; readonly leadId: string | null } = {
            workspaceId: turn.workspaceId,
            agentId: turn.agentId,
            runId: turn.turnId,
            conversationId: turn.conversationId,
            origin,
            memberId: turn.memberId ?? null,
            scope: origin === "customer" ? "public" : "workspace",
            expiresAt: this.clock.now().getTime() + TOKEN_TTL_MS,
            contactId: runContactOf(turn),
            leadId: runLeadOf(turn),
            ...(step === undefined ? {} : { step }),
        }
        return signRunToken(this.key, claims)
    }

    /** The claims of a token this process minted and that has not expired; null otherwise. */
    verify(token: string): OptionalRunClaims {
        return verifyRunToken(this.key, token, this.clock.now().getTime())
    }
}
