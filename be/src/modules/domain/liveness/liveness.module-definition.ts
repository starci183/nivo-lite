import { defineCapabilityModule } from "@starci/nest-kit"
import type { LivenessOptions } from "./liveness.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<LivenessOptions>()
