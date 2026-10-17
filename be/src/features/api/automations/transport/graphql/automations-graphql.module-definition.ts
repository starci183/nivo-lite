import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AutomationsGraphqlOptions } from "./automations-graphql.options"

/** The configurable-module base of the automations-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AutomationsGraphqlOptions>().setClassMethodName("register").build()
