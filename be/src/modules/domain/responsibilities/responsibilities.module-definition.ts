import { defineCapabilityModule } from "@starci/nest-kit"
import type { ResponsibilitiesOptions } from "./responsibilities.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ResponsibilitiesOptions>()
