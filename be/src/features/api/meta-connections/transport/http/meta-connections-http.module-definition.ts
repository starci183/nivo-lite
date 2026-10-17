import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { MetaConnectionsHttpOptions } from "./meta-connections-http.options"

/** The configurable-module base of the meta-connections-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<MetaConnectionsHttpOptions>().setClassMethodName("register").build()
