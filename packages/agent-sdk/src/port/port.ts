import { SdkDefinitionError } from "../block/definition-error"
import { isNamespaced } from "../schema/namespaced"
import type { Namespaced } from "../schema/schema.types"
import type { PortDefinition, PortMap, PortProvider, PortsOf } from "./port.types"

/** Defines a typed port. Throws `SdkDefinitionError` (`ID_MALFORMED`) for a malformed id, at module load. */
export const definePort = <T>(id: Namespaced): PortDefinition<T> => {
    if (!isNamespaced(id)) throw new SdkDefinitionError("ID_MALFORMED", id)
    return { entry: "port", id }
}

/**
 * The implementations of a port map for one request: the one place a door and a graph node build the ports a `run` receives, so
 * the UI and the agent execute the same code on the same ports.
 */
export function portsOf<P extends PortMap>(provider: PortProvider, ports: P): PortsOf<P>
/** The ports as they come: the signature above types them by the map, which a loop over its entries cannot check. */
export function portsOf(provider: PortProvider, ports: PortMap): Readonly<Record<string, unknown>> {
    return Object.fromEntries(Object.entries(ports).map(([name, port]) => [name, provider.implementationOf(port)]))
}

/** What a provider throws for a port it does not support: `SdkDefinitionError` `PORT_UNPROVIDED` naming the port. */
export const unprovided = (port: PortDefinition<unknown>): never => {
    throw new SdkDefinitionError("PORT_UNPROVIDED", port.id)
}
