import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./accounting-adjustments.module-definition"
import { AccountingAdjustmentsService } from "./accounting-adjustments.service"

@Module({})
/** Registers the adjustments capability once for the application. */
export class AccountingAdjustmentsModule extends ConfigurableModuleClass {
    /** Registers the capability and exports its services. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AccountingAdjustmentsService],
            exports: [AccountingAdjustmentsService],
        }
    }
}
