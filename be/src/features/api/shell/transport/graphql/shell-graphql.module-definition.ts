import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ShellGraphqlOptions } from "./shell-graphql.options"

/** The configurable-module base of the shell-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ShellGraphqlOptions>().setClassMethodName("register").build()
