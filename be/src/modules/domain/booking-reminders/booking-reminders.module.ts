import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AutomationPipelinesModule } from "@modules/domain/automation-pipelines"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./booking-reminders.module-definition"
import { BookingRemindersService } from "./booking-reminders.service"

@Module({})
/** The booking reminders capability: the reminder rows of a booking inside the transaction of its owner. */
export class BookingRemindersModule extends ConfigurableModuleClass {
    /** Registers the capability for the bookings capability that imports it. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), AutomationPipelinesModule.register({})],
            providers: [...(base.providers ?? []), BookingRemindersService],
            exports: [BookingRemindersService],
        }
    }
}
