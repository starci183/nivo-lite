import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { GoogleConnectionsApiOptions } from "./google-connections.options"

/** The configurable-module base of the google-connections module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<GoogleConnectionsApiOptions>().setClassMethodName("register").build()
