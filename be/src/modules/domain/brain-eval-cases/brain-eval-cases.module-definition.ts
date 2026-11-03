import { defineCapabilityModule } from "@starci/nest-kit"
import type { BrainEvalCasesOptions } from "./brain-eval-cases.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BrainEvalCasesOptions>()
