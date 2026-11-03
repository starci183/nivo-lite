import { defineCapabilityModule } from "@starci/nest-kit"
import type { BrainLessonsOptions } from "./brain-lessons.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BrainLessonsOptions>()
