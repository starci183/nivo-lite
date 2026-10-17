import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConnectionCommandsJobOptions } from "./connection-commands.options"

/** The configurable-module base of the connection-commands module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ConnectionCommandsJobOptions>().setClassMethodName("register").build()
