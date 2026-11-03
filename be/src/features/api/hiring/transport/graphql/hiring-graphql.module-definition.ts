import { defineConfigurableModule } from "@starci/nest-kit"
import type { HiringGraphqlOptions } from "./hiring-graphql.options"

/** The configurable-module base of the hiring-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<HiringGraphqlOptions>()
