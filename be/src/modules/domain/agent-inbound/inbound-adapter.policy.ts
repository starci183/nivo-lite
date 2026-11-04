import type { AgentWakeTraits } from "@modules/domain/agent-wake-rules"
import type { InboundTrust } from "@modules/domain/intent-contracts"
import type { InboundActor, InboundAdapter } from "./agent-inbound.contracts"

/** The roles whose word on a tag may change things. */
const MANAGER_ROLES: ReadonlySet<string> = new Set(["owner", "manager"])

/**
 * What the work core needs to know of the source an adapter declares. An internal adapter is a tick nobody asked for: it is background
 * work, and a switch that held it does not bring it back. Any adapter someone wrote to (a session, a signature) is work a person waits
 * on or may be waiting on, so it is restored. The adapter that awaits an answer locks by conversation.
 */
export const wakeTraitsOf = (adapter: InboundAdapter): AgentWakeTraits => ({
    priority: adapter.priority,
    maxAttempts: adapter.maxAttempts,
    scopedToConversation: adapter.awaitsAnswer,
    background: adapter.authentication === "internal",
    restoresHeld: adapter.authentication !== "internal",
    awaitsAnswer: adapter.awaitsAnswer,
})

/**
 * The trust of an actor that a member or an agent declares: the system is the system, an owner or manager is a manager, anyone else of the
 * workspace is a member. What a member or an agent may then do is for the plug-in to decide, not this function.
 */
export const actorTrustOf = (actor: InboundActor): InboundTrust => {
    if (actor.kind === "system") return "system"
    return actor.role !== null && MANAGER_ROLES.has(actor.role) ? "manager" : "member"
}
