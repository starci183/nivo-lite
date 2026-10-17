import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WorkspacesApiOptions } from "./workspaces.options"

/** The configurable-module base of the workspaces module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<WorkspacesApiOptions>().setClassMethodName("register").build()
