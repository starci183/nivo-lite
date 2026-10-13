import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./booking-exceptions.module-definition"
import { BookingExceptionsService } from "./booking-exceptions.service"

@Module({})
/** The booking calendar exceptions capability and its persistence owner. */
export class BookingExceptionsModule extends ConfigurableModuleClass {
    /** Registers date-exception persistence for the capability that coordinates its writes. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), BookingExceptionsService],
            exports: [BookingExceptionsService],
        }
    }
}
