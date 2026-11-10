import { defineConfigurableModule } from "@starci/nest-kit"
import type { SchedulesGraphqlOptions } from "./schedules-graphql.options"

/** The configurable-module base of the schedules-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SchedulesGraphqlOptions>()
