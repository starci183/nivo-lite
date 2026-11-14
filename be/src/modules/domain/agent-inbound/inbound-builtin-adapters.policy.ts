import type { InboundActor, InboundAdapter } from "./agent-inbound.contracts"
import { actorTrustOf } from "./inbound-adapter.policy"

/** The step kind of the door of an adapter that never takes the contract pipeline. */
export const NO_DOOR = "none"

const clockLike = (key: string, priority: number): InboundAdapter => ({
    key,
    authentication: "internal",
    trustOf: () => "system",
    awaitsAnswer: false,
    replyStep: null,
    doorStep: NO_DOOR,
    priority,
    maxAttempts: 3,
})

/** A tag in Office: whoever tagged declares who they are, and the trust follows from the actor. */
const tagAdapter: InboundAdapter = {
    key: "tag",
    authentication: "session",
    trustOf: (actor: InboundActor) => actorTrustOf(actor),
    awaitsAnswer: false,
    replyStep: null,
    doorStep: "tag_door",
    priority: 20,
    maxAttempts: 3,
}

/** The events of the business: a tick nobody asked for, run by the system. */
const internalAdapter: InboundAdapter = clockLike("internal", 30)

/** The clock: a slot that came due, run by the system. */
const scheduleAdapter: InboundAdapter = clockLike("schedule", 40)

/**
 * The three sources that existed before adapters and still write wakes, declared the way any adapter is. Their wakes still arrive through
 * their own doors. A customer's message is no adapter any more: every channel delivers through the one event pipeline (`deliver`).
 */
export const builtInAdapters = (): ReadonlyArray<InboundAdapter> => [
    tagAdapter,
    internalAdapter,
    scheduleAdapter,
]
