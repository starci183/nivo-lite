import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { InterfaceReadProvider, ProviderRegistryReads } from "./provider-reads.contracts"
import type { WorkbenchDoorOptions } from "./workbench-door.options"

/** Token of the workbench door options, exported so a spec can provide it. */
export const WORKBENCH_DOOR_OPTIONS: unique symbol = Symbol("domain.workbench-door.options")

/** Token of the providers that registered workbench reads; absent in an app where none did. */
export const INTERFACE_READ_PROVIDERS: unique symbol = Symbol("domain.workbench-door.read-providers")

/** Injects the providers that registered workbench reads. Parameter type: ReadonlyArray<InterfaceReadProvider>. */
export const InjectInterfaceReadProviders = (): TypedParameterDecorator<ReadonlyArray<InterfaceReadProvider>> =>
    injector<ReadonlyArray<InterfaceReadProvider>>(INTERFACE_READ_PROVIDERS)

/** Token of the registry reads every provider answers (`docs`, `config`, `rights`); absent in an app that serves none. */
export const PROVIDER_REGISTRY_READS_PORT: unique symbol = Symbol("domain.workbench-door.provider-registry-reads")

/** Injects the registry reads. Parameter type: ProviderRegistryReads. */
export const InjectProviderRegistryReads = (): TypedParameterDecorator<ProviderRegistryReads> =>
    injector<ProviderRegistryReads>(PROVIDER_REGISTRY_READS_PORT)

/** Injects the options of the workbench door. Parameter type: WorkbenchDoorOptions. */
export const InjectWorkbenchDoorOptions = (): TypedParameterDecorator<WorkbenchDoorOptions> =>
    injector<WorkbenchDoorOptions>(WORKBENCH_DOOR_OPTIONS)
