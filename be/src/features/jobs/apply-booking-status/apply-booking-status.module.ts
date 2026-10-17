import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./apply-booking-status.module-definition"
import { ApplyStep } from "./steps/apply.step"

@Module({ providers: [ApplyStep], exports: [ApplyStep] })
/** The application of the apply-booking-status job: its step; the queue transport module imports it. */
export class ApplyBookingStatusModule extends ConfigurableModuleClass {}
