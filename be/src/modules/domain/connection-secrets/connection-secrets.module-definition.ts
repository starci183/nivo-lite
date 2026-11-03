import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { CONNECTION_SECRETS_OPTIONS } from "./connection-secrets.decorators"
import type { ConnectionSecretsOptions } from "./connection-secrets.options"

/** The configurable-module base of the connection-secrets capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<ConnectionSecretsOptions>({
    optionsInjectionToken: CONNECTION_SECRETS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ConnectionSecretsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ConnectionSecretsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
