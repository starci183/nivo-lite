import { defineConfigurableModule } from "@starci/nest-kit"
import type { ShellGraphqlOptions } from "./shell-graphql.options"

/** The configurable-module base of the shell-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ShellGraphqlOptions>()
