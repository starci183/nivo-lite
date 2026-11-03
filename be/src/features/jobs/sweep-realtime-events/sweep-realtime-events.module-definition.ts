import { defineConfigurableModule } from "@starci/nest-kit"
import type { SweepRealtimeEventsOptions } from "./sweep-realtime-events.options"

/** The configurable-module base of the sweep-realtime-events module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SweepRealtimeEventsOptions>()
