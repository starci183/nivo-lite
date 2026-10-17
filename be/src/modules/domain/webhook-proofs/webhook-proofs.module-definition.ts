import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { WebhookProofsOptions } from "./webhook-proofs.options"

/** The configurable-module base of the webhook-proofs capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<WebhookProofsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
