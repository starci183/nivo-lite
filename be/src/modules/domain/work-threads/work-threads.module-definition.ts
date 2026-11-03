import { defineCapabilityModule } from "@starci/nest-kit"
import type { WorkThreadsOptions } from "./work-threads.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<WorkThreadsOptions>()
