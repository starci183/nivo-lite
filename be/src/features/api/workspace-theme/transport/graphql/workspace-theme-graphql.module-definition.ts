import { defineConfigurableModule } from "@starci/nest-kit"
import type { WorkspaceThemeGraphqlOptions } from "./workspace-theme-graphql.options"

/** The configurable-module base of the workspace-theme-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<WorkspaceThemeGraphqlOptions>()
