import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ProcessPublicApiOptions } from "./process-public-api.options"

/** The configurable-module base of the public API processing job. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ProcessPublicApiOptions>().setClassMethodName("register").build()
