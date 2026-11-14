import { defineConfigurableModule } from "@starci/nest-kit"
import type { ProviderSandboxApiOptions } from "./provider-sandbox.options"

/** The configurable-module base of the provider-sandbox module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ProviderSandboxApiOptions>()
