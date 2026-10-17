import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { GoogleConnectionsHttpOptions } from "./google-connections-http.options"

/** The configurable-module base of the google-connections-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<GoogleConnectionsHttpOptions>().setClassMethodName("register").build()
