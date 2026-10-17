import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./webhook-proofs.module-definition"
import { ScopedWebhookVerifier } from "./scoped-webhook-verifier.service"

@Module({})
/** The domain proof capability for deliveries whose credentials belong to a connection. */
export class WebhookProofsModule extends ConfigurableModuleClass {
    /** Registers the scoped verifier once in the app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ScopedWebhookVerifier],
            exports: [ScopedWebhookVerifier],
        }
    }
}
