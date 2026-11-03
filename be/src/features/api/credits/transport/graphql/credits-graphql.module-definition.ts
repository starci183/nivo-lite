import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { CreditsGraphqlOptions } from "./credits-graphql.options"

type Host = ConfigurableModuleHost<CreditsGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<CreditsGraphqlOptions>().setClassMethodName("register").build()

/** The configurable-module base of the credits-graphql module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the credits-graphql module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the credits-graphql module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
