import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { OfficeRoomDirectoryOptions } from "./office-room-directory.options"

/** The configurable-module base of the office room directory sub-module. */
const definition = new ConfigurableModuleBuilder<OfficeRoomDirectoryOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<OfficeRoomDirectoryOptions, "register", "create"> =
    definition.ConfigurableModuleClass
