import type { AgentWakeContext, AgentWakeSource } from "@modules/domain/agent-work"
import type {
    IntentAudience,
    IntentContract,
    IntentReading,
    IntentTrace,
    IntentTrigger,
    TurnContracts,
} from "@modules/domain/intent-contracts"
import type { BridgeTurn } from "@modules/domain/agent-tools"
import type { IntentPlan, IntentReadingRow, IntentScope, OptionalIntent } from "./agent-turns.contracts"

/** The step kinds of a pipeline turn: the model's text, its reading, and the door of each trigger. */
export const INTENT_STEP_KIND = {
    turn: "turn",
    readResult: "read_result",
    customerDoor: "door",
    tagDoor: "tag_door",
} as const

/** The node keys of the published graph the steps stand for. */
export const INTENT_NODE_KEY = {
    turn: "intent_turn",
    readResult: "intent_read_result",
    door: "intent_door",
} as const

/** The longest model text a step row keeps. */
export const TURN_TEXT_MAX = 40_000

/** The trigger step of the graph a wake of this source starts at; null for a source the contract pipeline does not serve. */
export const triggerOf = (source: AgentWakeSource): IntentTrigger | null => {
    if (source === "customer") return "customer_message"
    return source === "tag" ? "tag" : null
}

/** The intent a wake is pinned to, or null: only the follow-up turn of a split carries one. */
export const pinnedOf = (context: AgentWakeContext): OptionalIntent => context.intent ?? null

/** The fact key of the follow-up wake of a split: the same turn splitting twice is one wake. */
export const splitEventKeyOf = (wakeId: string, intent: string): string => `intent:${wakeId}:${intent}`

/** The contracts a turn is offered: all of them on a first turn, the one it is pinned to on a follow-up (none if the graph dropped it). */
export const offeredOf = (contracts: TurnContracts, pinned: string | null): ReadonlyArray<IntentContract> =>
    pinned === null ? contracts.contracts : contracts.contracts.filter((contract) => contract.intent === pinned)

/** Whether a tool of this scope writes: anything but a read. */
export const writesOf = (scope: string): boolean => scope !== "read"

/** What the model's text came to, kept on the turn: the trace that is compared with the published graph. */
export const traceOf = (plan: IntentPlan, reading: IntentReading): IntentTrace => {
    const base = {
        versionId: plan.versionId,
        trigger: plan.trigger,
        audience: plan.audience,
        offered: plan.contracts.map((contract) => contract.intent),
    }
    if (reading.kind === "safe") {
        return { ...base, intent: reading.intent, result: reading.cause, detail: reading.detail, dropped: [] }
    }
    const dropped = reading.kind === "picked" ? reading.dropped : []
    return { ...base, intent: reading.contract.intent, result: reading.kind, detail: "", dropped }
}

/** The audience of a tag: a manager when its author may write, else staff. */
export const tagAudienceOf = (mayWrite: boolean): IntentAudience => (mayWrite ? "manager" : "staff")

/** The scope a running turn of the bridge belongs to: read from the turn row and never from what the model sent. */
export const intentScopeOf = (turn: BridgeTurn): IntentScope => ({
    workspaceId: turn.workspaceId,
    agentId: turn.agentId,
    source: turn.source,
    authorUserId: turn.authorUserId,
    pinned: turn.pinnedIntent ?? null,
})

/** The reading as a step row keeps it: the result of a picked intent is kept as the JSON text a door reads. */
export const readingRowOf = (reading: IntentReading): IntentReadingRow =>
    reading.kind === "picked"
        ? {
              kind: "picked",
              contract: reading.contract,
              resultText: JSON.stringify(reading.result),
              dropped: reading.dropped,
          }
        : reading
