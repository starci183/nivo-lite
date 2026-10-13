import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LoyaltyProgramsOptions } from "./loyalty-programs.options"

/** The configurable-module base of the loyalty programs capability; `isGlobal` is decided by the importer. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LoyaltyProgramsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
