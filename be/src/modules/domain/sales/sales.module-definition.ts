import { defineCapabilityModule } from "@starci/nest-kit"
import type { SalesOptions } from "./sales.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<SalesOptions>()
