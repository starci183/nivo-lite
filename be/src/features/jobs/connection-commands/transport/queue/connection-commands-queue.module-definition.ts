import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConnectionCommandsQueueOptions } from "./connection-commands-queue.options"

/** The configurable-module base of the connection-commands-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ConnectionCommandsQueueOptions>().setClassMethodName("register").build()
