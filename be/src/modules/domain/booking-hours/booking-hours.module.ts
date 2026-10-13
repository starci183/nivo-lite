import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./booking-hours.module-definition"
import { BookingHoursService } from "./booking-hours.service"

@Module({})
/** The weekly booking hours capability and its persistence owner. */
export class BookingHoursModule extends ConfigurableModuleClass {
    /** Registers opening-window persistence for the capability that coordinates its writes. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), BookingHoursService],
            exports: [BookingHoursService],
        }
    }
}
