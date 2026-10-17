import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ModulesGraphqlOptions } from "./modules-graphql.options"

/** The configurable-module base of the modules-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ModulesGraphqlOptions>().setClassMethodName("register").build()
