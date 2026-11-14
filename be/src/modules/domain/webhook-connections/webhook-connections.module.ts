import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./webhook-connections.module-definition"
import { WebhookConnectionsService } from "./webhook-connections.service"
import { WebhookEventsService } from "./webhook-events.service"
import { WebhookLiveSendService } from "./webhook-live-send.service"
import { WebhookProviderRegistrationService } from "./webhook-provider-registration.service"
import { WebhookSandboxSendService } from "./webhook-sandbox-send.service"
import { WebhookSendRegistryService } from "./webhook-send-registry.service"

@Module({})
/** The outgoing webhook (n8n) connections over the connections capability: the wizard, the business events they receive, and the outgoing port (live and sandbox) both post through. */
export class WebhookConnectionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                WebhookConnectionsService,
                WebhookEventsService,
                WebhookSendRegistryService,
                WebhookLiveSendService,
                WebhookSandboxSendService,
                WebhookProviderRegistrationService,
            ],
            exports: [WebhookConnectionsService, WebhookEventsService],
        }
    }
}
