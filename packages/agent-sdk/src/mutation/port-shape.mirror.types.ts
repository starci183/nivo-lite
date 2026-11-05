/**
 * A MIRROR of wave 1's `definePort` result (packages/agent-sdk/src/port, A1), until it lands: the lead swaps every import of this file
 * for `../port`. The declared shape is a port id and, as a phantom, the api a provider implements.
 */
export interface PortShape<T = unknown> {
    /** Discriminant. */
    readonly entry: "port"
    /** The port id, `<group>.<name>`. */
    readonly id: string
    /** Phantom: never set; carries the api type of the port. */
    readonly __shape?: T
}

/** The ports a job or an action asks for, by the name it calls them. */
export type PortMap = Readonly<Record<string, PortShape>>

/** The apis of a port map: what the run receives. */
export type PortsOf<P extends PortMap> = { readonly [K in keyof P]: P[K] extends PortShape<infer T> ? T : never }
