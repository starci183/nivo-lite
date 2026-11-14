import { defineCapabilityModule } from "@starci/nest-kit"
import type { PluginServicesOptions } from "./plugin-services.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<PluginServicesOptions>()
