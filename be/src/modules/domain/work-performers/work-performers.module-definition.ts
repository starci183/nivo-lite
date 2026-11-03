import { defineCapabilityModule } from "@starci/nest-kit"
import type { WorkPerformersOptions } from "./work-performers.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<WorkPerformersOptions>()
