import type { Namespaced } from "../schema/schema.types"

/**
 * A typed capability a read, an action or a node needs; the host (the back end) provides it. `T` is its method shape. `__shape` is
 * a phantom member: it carries `T` for the type system and is never set or read.
 */
export interface PortDefinition<T> {
    /** Tells a port from a block, a read or an action in the registry. */
    readonly entry: "port"
    /** The registry id the host provides the port under, `<module>.<name>`. */
    readonly id: Namespaced
    /** Phantom: the method shape the host implements. */
    readonly __shape?: T
}

/** The ports a read or an action names, by the local name its `run` reaches them by. */
export type PortMap = Readonly<Record<string, PortDefinition<unknown>>>

/** The method shape a port definition stands for. */
export type PortOf<D> = D extends PortDefinition<infer T> ? T : never

/** The implementations of a port map, by the same local names: what `run` receives. */
export type PortsOf<P extends PortMap> = { readonly [K in keyof P]: PortOf<P[K]> }

/**
 * What a host implements: the provider of each port id it supports. A provider answers a port it does not support by calling
 * `unprovided(port)`, which throws `PORT_UNPROVIDED`. It answers `unknown` on purpose: the host maps ids to implementations, and
 * the one place that types the answer by the port is `portsOf`; a host written with the generic signature
 * `<T>(port: PortDefinition<T>) => T` is assignable to this one.
 */
export interface PortProvider {
    /** The implementation of a port for the request the provider was built for. */
    readonly implementationOf: (port: PortDefinition<unknown>) => unknown
}

/** Who a read or an action runs for, and when: the request scope the host built its ports for. */
export interface RunContext {
    /** The workspace whose data the run touches. */
    readonly workspaceId: string
    /** The member who asked; null for a customer, a schedule or the agent. */
    readonly memberId: string | null
    /** The instant of the run, so a rule never reads the clock itself. */
    readonly now: Date
    /** The IANA time zone of the workspace (for example `Asia/Ho_Chi_Minh`), in which "today", "this week" and "this month" begin. */
    readonly timeZone: string
}
