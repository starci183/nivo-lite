import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./booking-resources.module-definition"
import { BookingResourcesService } from "./booking-resources.service"

@Module({})
/** Owns booking resource writes and the row locks used by calendar setup transactions. */
export class BookingResourcesModule extends ConfigurableModuleClass {
    /** Registers the resource capability for its importer. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), BookingResourcesService],
            exports: [BookingResourcesService],
        }
    }
}
