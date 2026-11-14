import { MetaReceiptPolicy } from "./meta-receipt.policy"
import { MetaDeliveryService } from "./meta-delivery.service"
import { MetaWebhookVerifierService } from "./meta-webhook-verifier.service"
import { Module, type DynamicModule, type OnModuleInit } from "@nestjs/common"
import { triggerDeclarations } from "@modules/domain/provider-triggers"
import { MetaCommentsModule } from "@modules/domain/meta-comments"
import { MetaThreadsModule } from "@modules/domain/meta-threads"
import { META_RECEIPT_PROCESSOR } from "./meta-inbox.decorators"
import { MetaInboxService } from "./meta-inbox.service"
import { META_TRIGGERS } from "./meta-message.trigger"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./meta-inbox.module-definition"

@Module({})
/** The door of the signed Meta webhook deliveries, keeping every event in the account data of its connection; it shares the messaging windows and the comments it records. */
export class MetaInboxModule extends ConfigurableModuleClass implements OnModuleInit {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const owners = [MetaThreadsModule.register({}), MetaCommentsModule.register({})]
        return {
            ...base,
            imports: [...(base.imports ?? []), ...owners],
            providers: [
                ...(base.providers ?? []),
                MetaInboxService,
                MetaReceiptPolicy,
                MetaDeliveryService,
                { provide: META_RECEIPT_PROCESSOR, useExisting: MetaInboxService },
                MetaWebhookVerifierService,
            ],
            exports: [...owners, MetaDeliveryService, MetaInboxService, MetaWebhookVerifierService],
        }
    }

    /** Registers the Page's and the Instagram account's message triggers once (Meta's messages have no provider module of their own). */
    onModuleInit(): void {
        triggerDeclarations.register(...META_TRIGGERS)
    }
}
