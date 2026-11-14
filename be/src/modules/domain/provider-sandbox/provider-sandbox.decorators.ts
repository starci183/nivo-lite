import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { ProviderSandboxSwitch } from "./provider-sandbox.contracts"
import type { ProviderSandboxStore } from "./provider-sandbox-store.port"
import type { SandboxWebhookPoster } from "./sandbox-webhook-poster.port"

/** Token of the sandbox store, exported so a spec or a world can provide the memory one. */
export const PROVIDER_SANDBOX_STORE: unique symbol = Symbol("domain.provider-sandbox.store")

/** Injects the sandbox store. Parameter type: ProviderSandboxStore. */
export const InjectProviderSandboxStore = (): TypedParameterDecorator<ProviderSandboxStore> =>
    injector<ProviderSandboxStore>(PROVIDER_SANDBOX_STORE)

/** Token of the dev switch (the options of the capability). */
export const PROVIDER_SANDBOX_SWITCH: unique symbol = Symbol("domain.provider-sandbox.switch")

/** Injects the dev switch. Parameter type: ProviderSandboxSwitch. */
export const InjectProviderSandboxSwitch = (): TypedParameterDecorator<ProviderSandboxSwitch> =>
    injector<ProviderSandboxSwitch>(PROVIDER_SANDBOX_SWITCH)

/** Token of the poster an inbound case's webhook calls go through (the loopback HTTP one in the api; a spec's recorder). */
export const SANDBOX_WEBHOOK_POSTER: unique symbol = Symbol("domain.provider-sandbox.webhook-poster")

/** Injects the webhook poster. Parameter type: SandboxWebhookPoster. */
export const InjectSandboxWebhookPoster = (): TypedParameterDecorator<SandboxWebhookPoster> =>
    injector<SandboxWebhookPoster>(SANDBOX_WEBHOOK_POSTER)

/** Token of the loopback port (the options' `loopbackPort`). */
export const SANDBOX_LOOPBACK_PORT: unique symbol = Symbol("domain.provider-sandbox.loopback-port")

/** Injects the loopback port. Parameter type: number | undefined. */
export const InjectSandboxLoopbackPort = (): TypedParameterDecorator<number | undefined> => injector<number | undefined>(SANDBOX_LOOPBACK_PORT)
