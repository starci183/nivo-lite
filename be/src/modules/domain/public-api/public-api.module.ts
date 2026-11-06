import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { PublicApiQueueModule } from "@modules/queues/public-api"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./public-api.module-definition"
import { PublicEventsService } from "./public-events.service"
import { PublicKnowledgeService } from "./public-knowledge.service"
import { PublicMessagesService } from "./public-messages.service"
import { PublicApiProcessingService } from "./public-api-processing.service"
import { PublicMessageFulfillmentService } from "./public-message-fulfillment.service"
import { PublicApiLedgerService } from "./public-api-ledger.service"
import { PublicConversationsService } from "./public-conversations.service"

@Module({})
/** The public-api capability over the primary PostgreSQL connection; an accepted request enqueues its follow-up work. */
export class PublicApiModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), PublicApiQueueModule.register({})],
            providers: [
                ...(base.providers ?? []),
                { provide: INBOX, useClass: InboxService },
                PublicEventsService,
                PublicKnowledgeService,
                PublicMessagesService,
                PublicApiProcessingService,
                PublicMessageFulfillmentService,
                PublicApiLedgerService,
                PublicConversationsService,
            ],
            exports: [PublicEventsService, PublicKnowledgeService, PublicMessagesService, PublicApiProcessingService],
        }
    }
}
