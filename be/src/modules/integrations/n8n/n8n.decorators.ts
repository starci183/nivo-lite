import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { N8nClient } from "./n8n.client"
import type { N8nHostResolver } from "./n8n.policy"
import type { N8nOptions } from "./n8n.options"

/** Token of the n8n options. */
export const N8N_OPTIONS: unique symbol = Symbol("integrations.n8n.options")
/** Token of the host resolver the target guard asks for the addresses of a host. */
export const N8N_HOST_RESOLVER: unique symbol = Symbol("integrations.n8n.host-resolver")

/** Token of the signed delivery client. */
export const N8N_CLIENT: unique symbol = Symbol("integrations.n8n.client")

/** Injects the signed delivery client. Parameter type: N8nClient. */
export const InjectN8nClient = (): TypedParameterDecorator<N8nClient> => injector<N8nClient>(N8N_CLIENT)

/** Injects the n8n options. Parameter type: N8nOptions. */
export const InjectN8nOptions = (): TypedParameterDecorator<N8nOptions> => injector<N8nOptions>(N8N_OPTIONS)

/** Injects the host resolver. Parameter type: N8nHostResolver. */
export const InjectN8nHostResolver = (): TypedParameterDecorator<N8nHostResolver> =>
    injector<N8nHostResolver>(N8N_HOST_RESOLVER)
