import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./webhook-connections.module-definition"
import { WebhookConnectionsService } from "./webhook-connections.service"

@Module({})
/** The outgoing webhook (n8n) connection wizard over the connections capability. */
export class WebhookConnectionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), WebhookConnectionsService],
            exports: [WebhookConnectionsService],
        }
    }
}
