import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { GraphqlOptions } from "./graphql.options"

/** The configurable-module base of the graphql capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<GraphqlOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    GraphqlOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: GraphqlOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
