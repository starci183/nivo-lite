import type { InboundAdapter } from "./agent-inbound.contracts"

/** An adapter, or none when nobody registered the key. */
export type OptionalInboundAdapter = InboundAdapter | undefined

/** Where adapters register. A plain port: a plug-in manifest calls `add` and nothing else. */
export interface InboundAdapterRegistry {
    /** Registers an adapter and records its traits with the work core; a second adapter for a key is a wiring bug. */
    add(adapter: InboundAdapter): void
    /** The adapter of a key, or undefined. */
    lookup(key: string): OptionalInboundAdapter
    /** The adapter of a key; an event of an adapter nobody registered cannot be delivered. */
    of(key: string): InboundAdapter
}
