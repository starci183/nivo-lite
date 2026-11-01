import type { EntityManager } from "typeorm"
import type { InboundChain } from "./agent-inbound.contracts"

/** Why a chain of agents is stopped. */
export type InboundStopReason = "depth_limit" | "agent_in_chain"

/** What the chain decided for one agent an event would wake. */
export type ChainStep =
    | {
          /** The agent may be woken. */
          readonly kind: "go"
          /** The chain the new wake belongs to. */
          readonly chain: InboundChain
      }
    | {
          /** The agent is not woken. */
          readonly kind: "stop"
          /** Why. */
          readonly reason: InboundStopReason
          /** The chain the event came with. */
          readonly chain: InboundChain
      }

/** An event that was not delivered because its chain of agents hit a limit. It is never dropped silently: a person is told. */
export interface InboundStop {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent that was not woken. */
    readonly agentId: string
    /** The chain. */
    readonly chainId: string
    /** How many agent wakes led to the event. */
    readonly depth: number
    /** The agents already in the chain. */
    readonly agentIds: ReadonlyArray<string>
    /** Why it stopped. */
    readonly reason: InboundStopReason
    /** The adapter that carried the event. */
    readonly adapter: string
    /** The event type. */
    readonly eventType: string
    /** The event's idempotency key. */
    readonly idempotencyKey: string
}

/** Tells a person that an event stopped at a limit. It runs in the door's transaction, so a stop that cannot be told rolls the event back and the sender retries. */
export interface InboundStopReporter {
    /** Tells a person. */
    report(tx: EntityManager, stop: InboundStop): Promise<void>
}

/** What the transport hands over once the signature of a webhook delivery is proven. */
export interface VerifiedDelivery {
    /** The endpoint the delivery was posted to: the connection that owns its secret. */
    readonly endpoint: string
    /** The exact request bytes. */
    readonly rawBody: Buffer | undefined
    /** The signature header the proof accepted, if any. */
    readonly signature: string | undefined
    /** The event type header, if any. */
    readonly eventType: string | undefined
    /** The delivery key header, if any. */
    readonly deliveryKey: string | undefined
}
