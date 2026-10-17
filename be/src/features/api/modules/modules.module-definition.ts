import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ModulesApiOptions } from "./modules.options"

/** The configurable-module base of the modules module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ModulesApiOptions>().setClassMethodName("register").build()
