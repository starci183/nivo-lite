import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SeedAutomationsOptions } from "./seed-automations.options"

/** The configurable-module base of the seed-automations module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SeedAutomationsOptions>().setClassMethodName("register").build()
