import { defineConfigurableModule } from "@starci/nest-kit"
import type { ToolsGraphqlOptions } from "./tools-graphql.options"

/** The configurable-module base of the tools registry GraphQL module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ToolsGraphqlOptions>()
