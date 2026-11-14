import { defineConfigurableModule } from "@starci/nest-kit"
import type { WorkspaceThemeApiOptions } from "./workspace-theme.options"

/** The configurable-module base of the workspace-theme module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<WorkspaceThemeApiOptions>()
