import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { AuthGraphqlOptions } from "./auth-graphql.options"

type Host = ConfigurableModuleHost<AuthGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<AuthGraphqlOptions>().setClassMethodName("register").build()

/** The configurable-module base of the auth-graphql module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the auth-graphql module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the auth-graphql module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
