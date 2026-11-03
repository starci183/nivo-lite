import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { PruneWorkspacesOptions } from "./prune-workspaces.options"

type Host = ConfigurableModuleHost<PruneWorkspacesOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<PruneWorkspacesOptions>().setClassMethodName("register").build()

/** The configurable-module base of the prune-workspaces module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the prune-workspaces module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the prune-workspaces module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
