import type { AgentHandlerEnding } from "@modules/domain/agent-work"
import type { AgentWakeInbound } from "@modules/domain/agent-wake-rules"
import { isIntentTrigger } from "@modules/domain/intent-contracts"
import type {
    InboundTrust,
    IntentContract,
    IntentInputPart,
    IntentTrigger,
    TurnContracts,
} from "@modules/domain/intent-contracts"

/** The longest event text a turn is shown; the rest of a payload is left out, never summarized by code. */
export const EVENT_TEXT_MAX = 8000

/** The kind of the input part that carries an event. */
export const EVENT_PART_KIND = "inbound_event"

/** The syntactically valid trigger identity; contract lookup still refuses a type with no published contract. */
export const triggerOfEvent = (eventType: string): IntentTrigger | null =>
    isIntentTrigger(eventType) ? eventType : null

/** The trusts a wake may carry. */
const TRUSTS: ReadonlyArray<InboundTrust> = ["outsider", "member", "manager", "system"]

/** The trust a stored wake names; anything else is the least there is. */
export const trustOfWake = (trust: string): InboundTrust => TRUSTS.find((known) => known === trust) ?? "outsider"

/** The contracts a turn is offered: all of them on a first turn, the one it is pinned to on a follow-up. */
export const offeredIn = (contracts: TurnContracts, pinned: string | null): ReadonlyArray<IntentContract> =>
    pinned === null ? contracts.contracts : contracts.contracts.filter((contract) => contract.intent === pinned)

/** The input of an event turn: its type and its payload as data. The builder wraps it; nothing in it is an instruction. */
export const eventPartsOf = (inbound: AgentWakeInbound): ReadonlyArray<IntentInputPart> => [
    {
        kind: EVENT_PART_KIND,
        text: `${inbound.eventType}\n${JSON.stringify(inbound.payload)}`.slice(0, EVENT_TEXT_MAX),
    },
]

/** Ends a wake with no model turn, with its reason on the Work tab. */
export const skippedBy = (reason: string): AgentHandlerEnding => ({ status: "skipped", reason, outcome: null })

/** Ends a wake held over, with its reason on the Work tab. */
export const heldBy = (reason: string): AgentHandlerEnding => ({ status: "held", reason, outcome: null })
