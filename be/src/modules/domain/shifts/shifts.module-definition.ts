import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ShiftsOptions } from "./shifts.options"

/** The configurable-module base of the shifts capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ShiftsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
