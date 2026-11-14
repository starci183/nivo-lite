import { SdkDefinitionError } from "../block/definition-error"
import { portsOf } from "../port/port"
import type { PortMap, PortProvider, RunContext } from "../port/port.types"
import { isNamespaced, isQualifiedAction, moduleKeyOfName } from "../schema/namespaced"
import type { Namespaced } from "../schema/schema.types"
import type { AnyServiceDefinition, ServiceConfig, ServiceContract, ServiceDefinition } from "./service.types"

/** Defines the interface the engine knows. Throws `SdkDefinitionError` (`ID_MALFORMED`) for a malformed id, at module load. */
export const defineServiceContract = <T>(id: Namespaced): ServiceContract<T> => {
    if (!isNamespaced(id)) throw new SdkDefinitionError("ID_MALFORMED", id)
    return { entry: "service-contract", id }
}

/**
 * Defines a plugin's implementation of a contract. Throws `SdkDefinitionError` at module load: `ID_MALFORMED` for an id that is not
 * `<package>.<agent>.<name>` or a port map entry that is no port, and `SERVICE_MODULE_MISMATCH` when the agent part of the id is not
 * `moduleKey` (the service of an agent is named by that agent).
 */
export const defineService = <T, P extends PortMap>(config: ServiceConfig<T, P>): ServiceDefinition<T, P> => {
    if (!isQualifiedAction(config.id)) throw new SdkDefinitionError("ID_MALFORMED", config.id)
    if (moduleKeyOfName(config.id) !== config.moduleKey) throw new SdkDefinitionError("SERVICE_MODULE_MISMATCH", config.id)
    for (const [name, port] of Object.entries(config.ports)) {
        if (port.entry !== "port") throw new SdkDefinitionError("ID_MALFORMED", `${config.id}.${name}`)
    }
    return {
        ...config,
        entry: "service",
        construct: (provider, context) => config.build(portsOf(provider, config.ports), context),
    }
}

/**
 * The implementation of a service for one request scope: the ports it names resolved from the host's provider (`portsOf`), then
 * `build`. The one place the engine builds a service, so a spec and the host run the same code.
 */
export const serviceOf = <T>(
    definition: Pick<ServiceDefinition<T>, "construct">,
    provider: PortProvider,
    context: RunContext,
): T => definition.construct(provider, context)

/** Whether an installed service implements a contract (same contract id); narrows it to the contract's shape, so the host never casts. */
export const isServiceOf = <T>(
    definition: AnyServiceDefinition,
    contract: ServiceContract<T>,
): definition is ServiceDefinition<T> => definition.contract.id === contract.id
