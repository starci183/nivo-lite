import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConnectionsApiOptions } from "./connections.options"

/** The configurable-module base of the connections module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ConnectionsApiOptions>().setClassMethodName("register").build()
