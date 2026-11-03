import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { AccountGraphqlOptions } from "./account-graphql.options"

type Host = ConfigurableModuleHost<AccountGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<AccountGraphqlOptions>().setClassMethodName("register").build()

/** The configurable-module base of the account-graphql module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the account-graphql module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the account-graphql module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
