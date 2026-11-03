import { defineConfigurableModule } from "@starci/nest-kit"
import type { FireAgentScheduleOptions } from "./fire-agent-schedule.options"

/** The configurable-module base of the fire-agent-schedule module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<FireAgentScheduleOptions>()
