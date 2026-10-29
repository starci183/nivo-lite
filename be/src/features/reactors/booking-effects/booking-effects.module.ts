import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./booking-effects.module-definition"
import { ApplyBookingEffectsHandler } from "./application/apply-booking-effects.handler"

@Module({ providers: [ApplyBookingEffectsHandler] })
/** The booking-effects reactor: the handlers its consumers dispatch to. */
export class BookingEffectsModule extends ConfigurableModuleClass {}
