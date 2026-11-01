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

/** A customer's message: outsiders, proven by the channel's signature, who wait for the answer. */
const customerAdapter: InboundAdapter = {
    key: "customer",
    authentication: "signature",
    trustOf: () => "outsider",
    awaitsAnswer: true,
    replyStep: "final_reply",
    doorStep: "door",
    priority: 10,
    maxAttempts: 2,
}

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

/** The four sources that existed before adapters, declared the way any adapter is. Their wakes still arrive through their own doors. */
export const builtInAdapters = (): ReadonlyArray<InboundAdapter> => [
    customerAdapter,
    tagAdapter,
    internalAdapter,
    scheduleAdapter,
]
