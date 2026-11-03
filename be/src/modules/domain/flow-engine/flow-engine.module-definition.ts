import { defineCapabilityModule } from "@starci/nest-kit"
import type { FlowEngineOptions } from "./flow-engine.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<FlowEngineOptions>()
