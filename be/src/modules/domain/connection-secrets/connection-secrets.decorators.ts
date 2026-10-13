import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ConnectionSecretsOptions } from "./connection-secrets.options"

/** Token of the options of the connection-secrets capability, exported so a spec can provide it. */
export const CONNECTION_SECRETS_OPTIONS: unique symbol = Symbol("domain.connection-secrets.options")

/** Injects the options of the connection-secrets capability. Parameter type: ConnectionSecretsOptions. */
export const InjectConnectionSecretsOptions = (): TypedParameterDecorator<ConnectionSecretsOptions> =>
    injector<ConnectionSecretsOptions>(CONNECTION_SECRETS_OPTIONS)
