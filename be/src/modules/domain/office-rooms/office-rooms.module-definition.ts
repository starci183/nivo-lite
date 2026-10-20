import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OfficeRoomsOptions } from "./office-rooms.options"

/** The configurable-module base of the office rooms capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OfficeRoomsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
