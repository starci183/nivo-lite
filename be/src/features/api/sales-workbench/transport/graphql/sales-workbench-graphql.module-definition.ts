import { defineConfigurableModule } from "@starci/nest-kit"
import type { SalesWorkbenchGraphqlOptions } from "./sales-workbench-graphql.options"

/** The configurable-module base of the sales-workbench-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SalesWorkbenchGraphqlOptions>()
