import { Module } from "@nestjs/common"
import { GENERIC_WEBHOOK_QUEUE_PRODUCER } from "./generic-webhook.decorators"
import { ConfigurableModuleClass } from "./generic-webhook.module-definition"
import { GenericWebhookQueue } from "./generic-webhook.queue"

@Module({
    providers: [GenericWebhookQueue, { provide: GENERIC_WEBHOOK_QUEUE_PRODUCER, useExisting: GenericWebhookQueue }],
    exports: [GenericWebhookQueue, GENERIC_WEBHOOK_QUEUE_PRODUCER],
})
/** Binds the transactional producer used by the domain's verified-delivery intake. */
export class GenericWebhookQueueModule extends ConfigurableModuleClass {}
