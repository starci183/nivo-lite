import { defineConfigurableModule } from "@starci/nest-kit"
import type { SchedulesApiOptions } from "./schedules.options"

/** The configurable-module base of the schedules module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SchedulesApiOptions>()
