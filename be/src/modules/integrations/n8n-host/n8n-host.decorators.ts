import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { N8nHost, N8nHostShell } from "./n8n-host.contracts"
import type { N8nHostOptions } from "./n8n-host.options"

/** Token of the n8n host options. */
export const N8N_HOST_OPTIONS: unique symbol = Symbol("integrations.n8n-host.options")
/** Token of the shell of the n8n host. */
export const N8N_HOST_SHELL: unique symbol = Symbol("integrations.n8n-host.shell")
/** Token of the n8n host sync. */
export const N8N_HOST: unique symbol = Symbol("integrations.n8n-host.sync")

/** Injects the n8n host sync. Parameter type: N8nHost. */
export const InjectN8nHost = (): TypedParameterDecorator<N8nHost> => injector<N8nHost>(N8N_HOST)

/** Injects the shell of the n8n host. Parameter type: N8nHostShell. */
export const InjectN8nHostShell = (): TypedParameterDecorator<N8nHostShell> => injector<N8nHostShell>(N8N_HOST_SHELL)

/** Injects the n8n host options. Parameter type: N8nHostOptions. */
export const InjectN8nHostOptions = (): TypedParameterDecorator<N8nHostOptions> =>
    injector<N8nHostOptions>(N8N_HOST_OPTIONS)
