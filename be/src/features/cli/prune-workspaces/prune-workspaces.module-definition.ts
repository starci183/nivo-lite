import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PruneWorkspacesOptions } from "./prune-workspaces.options"

/** The configurable-module base of the prune-workspaces module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PruneWorkspacesOptions>().setClassMethodName("register").build()
