import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { MetaConnectionsApiOptions } from "./meta-connections.options"

/** The configurable-module base of the meta-connections module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<MetaConnectionsApiOptions>().setClassMethodName("register").build()
