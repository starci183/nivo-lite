import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { VietcombankHttpOptions } from "./vietcombank-http.options"

/** The configurable-module base of the vietcombank-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<VietcombankHttpOptions>().setClassMethodName("register").build()
