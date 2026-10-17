import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WorkspacesGraphqlOptions } from "./workspaces-graphql.options"

/** The configurable-module base of the workspaces-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<WorkspacesGraphqlOptions>().setClassMethodName("register").build()
