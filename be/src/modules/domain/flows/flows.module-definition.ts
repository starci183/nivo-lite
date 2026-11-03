import { defineCapabilityModule } from "@starci/nest-kit"
import type { FlowsOptions } from "./flows.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<FlowsOptions>()
