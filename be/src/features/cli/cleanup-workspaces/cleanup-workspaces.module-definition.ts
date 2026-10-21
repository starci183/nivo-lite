import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CleanupWorkspacesOptions } from "./cleanup-workspaces.options"

/** The configurable-module base of the cleanup-workspaces module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CleanupWorkspacesOptions>().setClassMethodName("register").build()
