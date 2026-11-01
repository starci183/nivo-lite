import type { AgentTurnView, AgentWake } from "@modules/domain/agent-work"
import { pinnedOf, splitEventKeyOf } from "./intent-turn.policy"
import type { IntentScope, InternalWakeRef, WakeRow } from "./agent-turns.contracts"

/** The wake and turn a door acts for, as a step row keeps it: ids, flags and a moment, so a door can settle from the row alone. */
export const wakeRowOf = (turn: AgentTurnView): WakeRow => ({
    workspaceId: turn.workspaceId,
    agentId: turn.agentId,
    scopeKey: turn.scopeKey,
    wakeId: turn.wakeId,
    turnId: turn.turnId,
    source: turn.source,
    eventKey: turn.eventKey,
    context: { ...turn.context },
    actorMemberId: turn.actorMemberId,
    attempts: turn.attempts,
    maxAttempts: turn.maxAttempts,
    wakeCreatedAt: turn.wakeCreatedAt.toISOString(),
})

/** The turn and wake a proposal settles for. */
export const wakeRefOf = (row: WakeRow): InternalWakeRef => ({
    workspaceId: row.workspaceId,
    agentId: row.agentId,
    wakeId: row.wakeId,
    turnId: row.turnId,
    source: row.source,
    authorUserId: typeof row.context.authorUserId === "string" ? row.context.authorUserId : null,
})

/** The follow-up wake of a split: the same facts as the wake it answers, pinned to the intent, under a key of its own. */
export const splitWakeOf = (row: WakeRow, intent: string): AgentWake => ({
    workspaceId: row.workspaceId,
    agentId: row.agentId,
    source: row.source,
    eventKey: splitEventKeyOf(row.wakeId, intent),
    context: { ...row.context, intent },
    actorMemberId: row.actorMemberId,
})

/** The turn and wake a view names, by ids alone. */
export const internalWakeOf = (turn: AgentTurnView): InternalWakeRef => ({
    workspaceId: turn.workspaceId,
    agentId: turn.agentId,
    wakeId: turn.wakeId,
    turnId: turn.turnId,
    source: turn.source,
    authorUserId: turn.context.authorUserId ?? null,
})

/** The scope of the turn a wake runs: the account that wrote a tag decides its audience, and a follow-up wake carries its pin. */
export const wakeScopeOf = (turn: AgentTurnView): IntentScope => ({
    workspaceId: turn.workspaceId,
    agentId: turn.agentId,
    source: turn.source,
    authorUserId: turn.context.authorUserId ?? null,
    pinned: pinnedOf(turn.context),
})
