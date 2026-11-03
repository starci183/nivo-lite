import { defineCapabilityModule } from "@starci/nest-kit"
import type { BrainDossiersOptions } from "./brain-dossiers.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BrainDossiersOptions>()
