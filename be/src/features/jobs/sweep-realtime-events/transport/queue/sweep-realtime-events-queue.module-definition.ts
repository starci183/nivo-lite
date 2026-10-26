import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SweepRealtimeEventsQueueOptions } from "./sweep-realtime-events-queue.options"

/** The configurable-module base of the sweep-realtime-events-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SweepRealtimeEventsQueueOptions>().setClassMethodName("register").build()
