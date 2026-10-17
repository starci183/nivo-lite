import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LeadsGraphqlOptions } from "./leads-graphql.options"

/** The configurable-module base of the leads-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<LeadsGraphqlOptions>().setClassMethodName("register").build()
