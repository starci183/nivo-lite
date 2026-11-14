import { defineCapabilityModule } from "@starci/nest-kit"
import type { ToolGrantsOptions } from "./tool-grants.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ToolGrantsOptions>()
