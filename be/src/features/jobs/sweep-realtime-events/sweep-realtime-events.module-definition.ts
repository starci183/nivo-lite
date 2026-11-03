import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { SweepRealtimeEventsOptions } from "./sweep-realtime-events.options"

type Host = ConfigurableModuleHost<SweepRealtimeEventsOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<SweepRealtimeEventsOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the sweep-realtime-events module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the sweep-realtime-events module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the sweep-realtime-events module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
