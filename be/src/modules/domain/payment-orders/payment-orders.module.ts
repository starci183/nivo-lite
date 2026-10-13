import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./payment-orders.module-definition"
import { PaymentOrdersService } from "./payment-orders.service"

@Module({})
/** The payment-orders capability over the primary Supabase connection. */
export class PaymentOrdersModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), PaymentOrdersService],
            exports: [PaymentOrdersService],
        }
    }
}
