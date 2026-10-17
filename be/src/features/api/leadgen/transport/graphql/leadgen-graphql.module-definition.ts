import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LeadGenGraphqlOptions } from "./leadgen-graphql.options"

/** The configurable-module base of the leadgen-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<LeadGenGraphqlOptions>().setClassMethodName("register").build()
