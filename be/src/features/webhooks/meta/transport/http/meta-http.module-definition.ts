import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { MetaHttpOptions } from "./meta-http.options"

/** The configurable-module base of the meta-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<MetaHttpOptions>().setClassMethodName("register").build()
