import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InboxSimulationGraphqlOptions } from "./inbox-simulation-graphql.options"

/** The configurable-module base of the inbox-simulation-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<InboxSimulationGraphqlOptions>().setClassMethodName("register").build()
