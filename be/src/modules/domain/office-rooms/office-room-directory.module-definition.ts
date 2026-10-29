import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OfficeRoomDirectoryOptions } from "./office-room-directory.options"

/** The configurable-module base of the office room directory sub-module. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OfficeRoomDirectoryOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
