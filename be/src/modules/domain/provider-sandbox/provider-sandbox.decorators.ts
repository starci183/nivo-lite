import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { ProviderSandboxStore } from "./provider-sandbox-store.port"

/** Token of the sandbox store, exported so a spec or a world can provide the memory one. */
export const PROVIDER_SANDBOX_STORE: unique symbol = Symbol("domain.provider-sandbox.store")

/** Injects the sandbox store. Parameter type: ProviderSandboxStore. */
export const InjectProviderSandboxStore = (): TypedParameterDecorator<ProviderSandboxStore> =>
    injector<ProviderSandboxStore>(PROVIDER_SANDBOX_STORE)
