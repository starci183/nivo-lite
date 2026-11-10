import { defineConfigurableModule } from "@starci/nest-kit"
import type { WorkspaceDashboardGraphqlOptions } from "./workspace-dashboard-graphql.options"

/** The configurable-module base of the workspace-dashboard-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<WorkspaceDashboardGraphqlOptions>()
