import { defineCapabilityModule } from "@starci/nest-kit"
import type { ThreadWorkOptions } from "./thread-work.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ThreadWorkOptions>()
