import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OfficeCommandCandidatesOptions } from "./office-command-candidates.options"

/** The configurable-module base of the office capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OfficeCommandCandidatesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
