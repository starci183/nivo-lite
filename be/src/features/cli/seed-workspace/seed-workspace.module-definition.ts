import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { SeedWorkspaceOptions } from "./seed-workspace.options"

type Host = ConfigurableModuleHost<SeedWorkspaceOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<SeedWorkspaceOptions>().setClassMethodName("register").build()

/** The configurable-module base of the seed-workspace module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the seed-workspace module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the seed-workspace module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
