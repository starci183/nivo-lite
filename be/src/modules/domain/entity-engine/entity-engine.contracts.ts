import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { ScopedTx } from "./policies/scoped-tx.contracts"

/** Work that runs in a scoped transaction. */
export type ScopedWork<T> = (tx: ScopedTx) => Promise<T>

/** Runs `use` in the scope a port is bound to: the one transaction of the caller, or a transaction of its own per call. */
export type RunIn = <T>(use: ScopedWork<T>) => Promise<T>

/** The ports a job or action asks for, by the name it calls them. */
export interface DeclaredPorts {
    /** The declaration of one port. */
    readonly [name: string]: PortDefinition<unknown>
}

/** The handles a job or action receives, by the name it called its ports. */
export interface JobPorts {
    /** The handle of one port. */
    readonly [name: string]: unknown
}
