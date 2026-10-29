import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OfficeRoomDirectoryOptions } from "./office-room-directory.options"

/** The configurable-module base of the office room directory sub-module. */
export const { ConfigurableModuleClass } = new ConfigurableModuleBuilder<OfficeRoomDirectoryOptions>()
    .setClassMethodName("register")
    .build()
