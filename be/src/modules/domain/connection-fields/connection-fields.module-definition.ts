import { defineCapabilityModule } from "@starci/nest-kit"
import type { ConnectionFieldsOptions } from "./connection-fields.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ConnectionFieldsOptions>()
