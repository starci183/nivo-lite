import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WorkThreadsGraphqlOptions } from "./work-threads-graphql.options"

/** The configurable-module base of the work-threads-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<WorkThreadsGraphqlOptions>().setClassMethodName("register").build()
