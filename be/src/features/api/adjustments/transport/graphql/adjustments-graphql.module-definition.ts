import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AdjustmentsGraphqlOptions } from "./adjustments-graphql.options"

/** The configurable-module base of the adjustments-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<AdjustmentsGraphqlOptions>().setClassMethodName("register").build()
