import type { AgentWakeInbound } from "@modules/domain/agent-work"
import type { InboundAdapter, InboundChain, InboundEvent } from "./agent-inbound.contracts"

/** The most bytes of payload the door keeps in a wake. */
export const PAYLOAD_BYTES_MAX = 32_000

/** True when the payload, written as JSON, fits what a wake keeps. */
export const payloadFits = (payload: InboundEvent["payload"]): boolean =>
    Buffer.byteLength(JSON.stringify(payload), "utf8") <= PAYLOAD_BYTES_MAX

/** The event as a wake keeps it: the adapter's trust of the actor and the chain of this wake. */
export const wakeInboundOf = (event: InboundEvent, adapter: InboundAdapter, chain: InboundChain): AgentWakeInbound => ({
    eventType: event.eventType,
    actor: event.actor,
    trust: adapter.trustOf(event.actor),
    chain,
    payload: event.payload,
    attachments: event.attachments,
    evidence: event.evidence,
})

/** The member behind a wake: the actor when it is a member, else nobody. */
export const memberOf = (event: InboundEvent): string | null => (event.actor.kind === "member" ? event.actor.id : null)
