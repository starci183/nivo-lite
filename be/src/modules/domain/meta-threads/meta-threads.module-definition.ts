import { defineCapabilityModule } from "@starci/nest-kit"
import type { MetaThreadsOptions } from "./meta-threads.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<MetaThreadsOptions>()
