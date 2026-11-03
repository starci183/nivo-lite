import { defineCapabilityModule } from "@starci/nest-kit"
import type { ConnectionGrantsOptions } from "./connection-grants.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ConnectionGrantsOptions>()
