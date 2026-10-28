import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SepayConnectionApiOptions } from "./sepay-connection.options"

/** The configurable-module base of the sepay-connection module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SepayConnectionApiOptions>().setClassMethodName("register").build()
