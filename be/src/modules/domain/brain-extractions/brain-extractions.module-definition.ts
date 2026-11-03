import { defineCapabilityModule } from "@starci/nest-kit"
import type { BrainExtractionsOptions } from "./brain-extractions.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BrainExtractionsOptions>()
