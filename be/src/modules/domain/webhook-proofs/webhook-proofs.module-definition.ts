import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { WebhookProofsOptions } from "./webhook-proofs.options"

/** The configurable-module base of the webhook-proofs capability. */
const definition = new ConfigurableModuleBuilder<WebhookProofsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    WebhookProofsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: WebhookProofsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
