import { defineConfigurableModule } from "@starci/nest-kit"
import type { ConnectionCommandsJobOptions } from "./connection-commands.options"

/** The configurable-module base of the connection-commands module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ConnectionCommandsJobOptions>()
