import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunShiftsAlertsOptions } from "./run-shifts-alerts.options"

/** The configurable-module base of the run-shifts-alerts module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunShiftsAlertsOptions>()
