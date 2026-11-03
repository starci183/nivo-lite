import { defineCapabilityModule } from "@starci/nest-kit"
import type { DataHubOptions } from "./data-hub.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<DataHubOptions>()
