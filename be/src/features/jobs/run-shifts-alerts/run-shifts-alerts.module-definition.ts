import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunShiftsAlertsOptions } from "./run-shifts-alerts.options"

type Host = ConfigurableModuleHost<RunShiftsAlertsOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunShiftsAlertsOptions>().setClassMethodName("register").build()

/** The configurable-module base of the run-shifts-alerts module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-shifts-alerts module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-shifts-alerts module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
