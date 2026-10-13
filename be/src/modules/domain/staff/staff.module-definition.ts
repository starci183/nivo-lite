import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { StaffOptions } from "./staff.options"

/** The configurable module base of the staff directory. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<StaffOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
