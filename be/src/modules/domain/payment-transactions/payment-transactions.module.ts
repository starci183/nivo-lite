import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./payment-transactions.module-definition"
import { PaymentTransactionsService } from "./payment-transactions.service"

@Module({})
/** The money movements of a workspace as `payment.transaction` records on the entity engine: what the bank feed writes and what the SePay tool reads. */
export class PaymentTransactionsModule extends ConfigurableModuleClass {
    /** Registers the capability in the apps that feed or read the bank movements. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), PaymentTransactionsService],
            exports: [PaymentTransactionsService],
        }
    }
}
