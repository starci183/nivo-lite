import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OfficeOptions } from "./office.options"

/** The configurable-module base of the office capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OfficeOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
