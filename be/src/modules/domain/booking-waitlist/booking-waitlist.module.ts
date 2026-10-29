import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BookingServicesModule } from "@modules/domain/booking-services"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./booking-waitlist.module-definition"
import { BookingWaitlistReadService } from "./booking-waitlist-read.service"
import { BookingWaitlistService } from "./booking-waitlist.service"

@Module({})
/** The capability that owns waitlist status changes. */
export class BookingWaitlistModule extends ConfigurableModuleClass {
    /** Registers waitlist persistence for the application operations that import it; the service catalogue it locks is re-exported to them. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const services = BookingServicesModule.register({})
        return {
            ...base,
            imports: [...(base.imports ?? []), services],
            providers: [...(base.providers ?? []), BookingWaitlistService, BookingWaitlistReadService],
            exports: [services, BookingWaitlistService, BookingWaitlistReadService],
        }
    }
}
