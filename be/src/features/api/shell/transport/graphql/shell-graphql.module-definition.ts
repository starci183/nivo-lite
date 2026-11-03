import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ShellGraphqlOptions } from "./shell-graphql.options"

type Host = ConfigurableModuleHost<ShellGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ShellGraphqlOptions>().setClassMethodName("register").build()

/** The configurable-module base of the shell-graphql module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the shell-graphql module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the shell-graphql module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
