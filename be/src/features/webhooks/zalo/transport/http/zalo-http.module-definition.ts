import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ZaloHttpOptions } from "./zalo-http.options"

/** The configurable-module base of the zalo-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ZaloHttpOptions>().setClassMethodName("register").build()
