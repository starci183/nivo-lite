import { defineCapabilityModule } from "@starci/nest-kit"
import type { ToolReseedOptions } from "./tool-reseed.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ToolReseedOptions>()
