import { defineConfigurableModule } from "@starci/nest-kit"
import type { WorkspaceDashboardApiOptions } from "./workspace-dashboard.options"

/** The configurable-module base of the workspace dashboard module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<WorkspaceDashboardApiOptions>()
