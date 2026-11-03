import { defineCapabilityModule } from "@starci/nest-kit"
import { CONNECTION_SECRETS_OPTIONS } from "./connection-secrets.decorators"
import type { ConnectionSecretsOptions } from "./connection-secrets.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ConnectionSecretsOptions>({
    optionsInjectionToken: CONNECTION_SECRETS_OPTIONS,
})
