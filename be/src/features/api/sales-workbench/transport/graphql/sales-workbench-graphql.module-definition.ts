import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SalesWorkbenchGraphqlOptions } from "./sales-workbench-graphql.options"

/** The configurable-module base of the sales-workbench-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SalesWorkbenchGraphqlOptions>().setClassMethodName("register").build()
