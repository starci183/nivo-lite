import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./booking-settings.module-definition"
import { BookingSettingsService } from "./booking-settings.service"

@Module({})
/** The capability that owns a workspace's booking policy and publishing settings. */
export class BookingSettingsModule extends ConfigurableModuleClass {
    /** Registers booking settings for the application operations that import it. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), BookingSettingsService],
            exports: [BookingSettingsService],
        }
    }
}
