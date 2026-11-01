import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { GenericHttpOptions } from "./generic-http.options"

/** The configurable-module base of the generic-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<GenericHttpOptions>().setClassMethodName("register").build()
