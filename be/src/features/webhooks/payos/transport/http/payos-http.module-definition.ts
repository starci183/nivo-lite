import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PayosHttpOptions } from "./payos-http.options"

/** The configurable-module base of the payos-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PayosHttpOptions>().setClassMethodName("register").build()
