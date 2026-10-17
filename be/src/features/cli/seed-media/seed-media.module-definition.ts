import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SeedMediaOptions } from "./seed-media.options"

/** The configurable-module base of the seed-media module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SeedMediaOptions>().setClassMethodName("register").build()
