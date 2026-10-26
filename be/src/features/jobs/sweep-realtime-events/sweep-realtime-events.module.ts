import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./sweep-realtime-events.module-definition"
import { SweepExpiredEventsStep } from "./steps/sweep-expired-events.step"

@Module({ providers: [SweepExpiredEventsStep], exports: [SweepExpiredEventsStep] })
/** The application of the sweep-realtime-events job: its step; the queue transport module imports it. */
export class SweepRealtimeEventsModule extends ConfigurableModuleClass {}
