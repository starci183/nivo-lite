import type { AnyServiceDefinition, ServiceContract, ServiceDefinition } from "@nivo-lite/agent-sdk/service"

/** The installed services the host reads: `INSTALLED` of the installed-plugins capability fits it. */
export interface PluginServiceCatalog {
    /** The service that implements `contract` for the module, or null when no installed plugin ships one. */
    readonly serviceFor: <T>(contract: ServiceContract<T>, moduleKey: string) => ServiceDefinition<T> | null
    /** Every installed service, in installation order: what `moduleKeyOf` looks the module of a contract up in. Absent: no contract has a module. */
    readonly services?: () => ReadonlyArray<AnyServiceDefinition>
}

/** What the app root tells the plugin services: where the installed services are read from. */
export interface PluginServicesOptions {
    /** The installed plugins' services. */
    readonly catalog: PluginServiceCatalog
}
