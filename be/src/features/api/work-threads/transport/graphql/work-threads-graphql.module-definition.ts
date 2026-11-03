import { defineConfigurableModule } from "@starci/nest-kit"
import type { WorkThreadsGraphqlOptions } from "./work-threads-graphql.options"

/** The configurable-module base of the work-threads-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<WorkThreadsGraphqlOptions>()
