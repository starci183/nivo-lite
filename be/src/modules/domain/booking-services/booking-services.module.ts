import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./booking-services.module-definition"
import { BookingServicesService } from "./booking-services.service"

@Module({})
/** Owns booking service catalogue writes and the row locks used by setup transactions. */
export class BookingServicesModule extends ConfigurableModuleClass {
    /** Registers the service catalogue capability for its importer. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), BookingServicesService],
            exports: [BookingServicesService],
        }
    }
}
