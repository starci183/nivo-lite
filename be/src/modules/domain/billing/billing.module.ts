import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BankCreditModule } from "@modules/queues/bank-credit"
import { BankFeedService } from "./bank-feed.service"
import { BillingReadService } from "./billing-read.service"
import { BillingService } from "./billing.service"
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } from "./billing.module-definition"
import { PaymentSecretsService } from "./payment-secrets.service"
import { EntitlementsService } from "./entitlements.service"
import { PaymentProofService } from "./payment-proof.service"
import { CassoProofService } from "./casso-proof.service"
import { PayosProofService } from "./payos-proof.service"
import { VietcombankProofService } from "./vietcombank-proof.service"
@Module({})
/** The billing capability over the primary Supabase connection: plans, payment orders, SePay settlement and the payment feeds. */
export class BillingModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), BankCreditModule],
            providers: [
                ...(base.providers ?? []),
                BillingService,
                BillingReadService,
                EntitlementsService,
                PaymentProofService,
                CassoProofService,
                PayosProofService,
                VietcombankProofService,
                PaymentSecretsService,
                BankFeedService,
            ],
            exports: [
                MODULE_OPTIONS_TOKEN,
                BillingService,
                BillingReadService,
                EntitlementsService,
                PaymentProofService,
                BankFeedService,
            ],
        }
    }
}
