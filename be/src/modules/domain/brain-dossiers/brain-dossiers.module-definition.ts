import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BrainDossiersOptions } from "./brain-dossiers.options"

/** The configurable-module base of the brain-dossiers capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BrainDossiersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
