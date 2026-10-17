import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ShiftsGraphqlOptions } from "./shifts-graphql.options"

/** The configurable-module base of the shifts-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ShiftsGraphqlOptions>().setClassMethodName("register").build()
