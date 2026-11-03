import { defineConfigurableModule } from "@starci/nest-kit"
import type { ModulesGraphqlOptions } from "./modules-graphql.options"

/** The configurable-module base of the modules-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ModulesGraphqlOptions>()
