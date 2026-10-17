import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CassoHttpOptions } from "./casso-http.options"

/** The configurable-module base of the casso-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CassoHttpOptions>().setClassMethodName("register").build()
