import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PublicApiQueueOptions } from "./public-api.options"

/** The configurable-module base of the public-api module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PublicApiQueueOptions>().setClassMethodName("register").build()
