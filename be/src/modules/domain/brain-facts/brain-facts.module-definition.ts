import { defineCapabilityModule } from "@starci/nest-kit"
import type { BrainFactsOptions } from "./brain-facts.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BrainFactsOptions>()
