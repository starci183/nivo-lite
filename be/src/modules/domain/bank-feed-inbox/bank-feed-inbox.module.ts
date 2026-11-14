import { Module, type DynamicModule, type OnModuleInit } from "@nestjs/common"
import { triggerDeclarations } from "@modules/domain/provider-triggers"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./bank-feed-inbox.module-definition"
import { BankFeedReceiptService } from "./bank-feed-inbox.service"
import { BANK_TRANSACTION_TRIGGERS } from "./bank-transaction.trigger"

@Module({})
/**
 * The durable receipts of the bank-feed webhooks, kept as delivery rows of each connection's account, and the one transaction trigger every
 * bank feed declares (one row shape for SePay, Casso and payOS), registered at boot.
 */
export class BankFeedInboxModule extends ConfigurableModuleClass implements OnModuleInit {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), BankFeedReceiptService],
            exports: [BankFeedReceiptService],
        }
    }

    /** Registers the bank feeds' transaction triggers once. */
    onModuleInit(): void {
        triggerDeclarations.register(...BANK_TRANSACTION_TRIGGERS)
    }
}
