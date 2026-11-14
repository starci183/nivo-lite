import { defineCapabilityModule } from "@starci/nest-kit"
import type { ProviderTriggersOptions } from "./provider-triggers.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineCapabilityModule<ProviderTriggersOptions>()
