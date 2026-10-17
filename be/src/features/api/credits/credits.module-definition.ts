import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CreditsApiOptions } from "./credits.options"

/** The configurable-module base of the credits module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CreditsApiOptions>().setClassMethodName("register").build()
