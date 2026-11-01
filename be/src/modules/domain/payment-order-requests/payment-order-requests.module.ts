import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./payment-order-requests.module-definition"
import { PaymentOrderRequestsService } from "./payment-order-requests.service"

@Module({})
/** The payment order requests over the primary PostgreSQL connection: the only writer of public.payment_order_requests. */
export class PaymentOrderRequestsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), PaymentOrderRequestsService],
            exports: [PaymentOrderRequestsService],
        }
    }
}
