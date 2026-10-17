import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RendersApiOptions } from "./renders.options"

/** The configurable-module base of the renders module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RendersApiOptions>().setClassMethodName("register").build()
