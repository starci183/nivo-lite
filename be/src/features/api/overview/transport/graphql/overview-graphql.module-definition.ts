import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OverviewGraphqlOptions } from "./overview-graphql.options"

/** The configurable-module base of the overview-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<OverviewGraphqlOptions>().setClassMethodName("register").build()
