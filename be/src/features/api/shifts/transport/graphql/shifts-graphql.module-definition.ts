import { defineConfigurableModule } from "@starci/nest-kit"
import type { ShiftsGraphqlOptions } from "./shifts-graphql.options"

/** The configurable-module base of the shifts-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ShiftsGraphqlOptions>()
