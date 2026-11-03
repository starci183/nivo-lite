import { defineConfigurableModule } from "@starci/nest-kit"
import type { PruneWorkspacesOptions } from "./prune-workspaces.options"

/** The configurable-module base of the prune-workspaces module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PruneWorkspacesOptions>()
