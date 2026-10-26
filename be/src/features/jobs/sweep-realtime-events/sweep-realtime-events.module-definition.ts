import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SweepRealtimeEventsOptions } from "./sweep-realtime-events.options"

/** The configurable-module base of the sweep-realtime-events module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SweepRealtimeEventsOptions>().setClassMethodName("register").build()
