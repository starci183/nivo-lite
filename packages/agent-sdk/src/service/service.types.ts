import type { Namespaced } from "../schema/schema.types"
import type { PortMap, PortProvider, PortsOf, RunContext } from "../port/port.types"

/**
 * An interface the ENGINE knows and a plugin implements: the engine asks the installed implementation of a contract for an agent's
 * module and never imports the plugin. `T` is its method shape. `__shape` is a phantom member: it carries `T` for the type system and
 * is never set or read.
 */
export interface ServiceContract<T> {
    /** Tells a contract from a port, a read or a service in the registry. */
    readonly entry: "service-contract"
    /** The registry id, `<namespace>.<name>` (two to four kebab-case parts), such as `engine.conversation-store`. */
    readonly id: Namespaced
    /** Phantom: the method shape the plugin implements. */
    readonly __shape?: T
}

/** What a plugin gives `defineService`. */
export interface ServiceConfig<T, P extends PortMap> {
    /** The service id, `<package>.<agent>.<name>` (the record name law: three kebab-case parts, the agent part being `moduleKey`). */
    readonly id: string
    /** The contract the service implements. */
    readonly contract: ServiceContract<T>
    /** The key of the module whose agent owns the service: the engine finds the service by this and the contract. */
    readonly moduleKey: string
    /** The ports `build` asks for, by the local name it reaches them by: the same ports a read or an action names. */
    readonly ports: P
    /** Builds the implementation over the ports the host provided for ONE request scope. Pure of ambient state. */
    readonly build: (ports: PortsOf<P>, context: RunContext) => T
}

/** A defined service. */
export interface ServiceDefinition<T = unknown, P extends PortMap = PortMap> extends ServiceConfig<T, P> {
    /** Discriminant. */
    readonly entry: "service"
    /** Resolves the ports from the host's provider, then builds (`serviceOf`); typed by the definition, so the host never casts. */
    readonly construct: (provider: PortProvider, context: RunContext) => T
}

/** A service of any contract and ports: what the installation lists. A `ServiceDefinition<T>` is one, and `isServiceOf` narrows it back. */
export interface AnyServiceDefinition {
    /** Discriminant. */
    readonly entry: "service"
    /** `<package>.<agent>.<name>`. */
    readonly id: string
    /** The contract the service implements. */
    readonly contract: ServiceContract<unknown>
    /** The module whose agent owns it. */
    readonly moduleKey: string
    /** The ports it asks for. */
    readonly ports: PortMap
    /** Builds the implementation over the ports of a provider. */
    readonly construct: (provider: PortProvider, context: RunContext) => unknown
}

/** The method shape a contract stands for. */
export type ServiceOf<C> = C extends ServiceContract<infer T> ? T : never
