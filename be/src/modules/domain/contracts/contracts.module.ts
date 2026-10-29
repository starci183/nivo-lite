import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./contracts.module-definition"
import { ContractLinkService } from "./contract-link.service"
import { ContractRenewalService } from "./contract-renewal.service"
import { ContractsService } from "./contracts.service"
import { PaymentReconciledContractsConsumer } from "./payment-reconciled-contracts.consumer"

@Module({})
/** The recurring sales contracts of a workspace over the primary Supabase PostgreSQL connection. */
export class ContractsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: INBOX, useClass: InboxService },
                ContractLinkService,
                ContractRenewalService,
                ContractsService,
                PaymentReconciledContractsConsumer,
            ],
            exports: [ContractsService],
        }
    }
}
