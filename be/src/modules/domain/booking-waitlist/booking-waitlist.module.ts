import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./booking-waitlist.module-definition"
import { BookingWaitlistService } from "./booking-waitlist.service"

@Module({})
/** The capability that owns waitlist status changes. */
export class BookingWaitlistModule extends ConfigurableModuleClass {
    /** Registers waitlist persistence for the application operations that import it. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), BookingWaitlistService],
            exports: [BookingWaitlistService],
        }
    }
}
