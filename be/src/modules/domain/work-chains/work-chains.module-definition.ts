import { defineCapabilityModule } from "@starci/nest-kit"
import type { WorkChainsOptions } from "./work-chains.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<WorkChainsOptions>()
