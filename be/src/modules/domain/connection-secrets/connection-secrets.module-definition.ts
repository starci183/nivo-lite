import { ConfigurableModuleBuilder } from "@nestjs/common"
import { CONNECTION_SECRETS_OPTIONS } from "./connection-secrets.decorators"
import type { ConnectionSecretsOptions } from "./connection-secrets.options"

/** The configurable-module base of the connection-secrets capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ConnectionSecretsOptions>({
    optionsInjectionToken: CONNECTION_SECRETS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
