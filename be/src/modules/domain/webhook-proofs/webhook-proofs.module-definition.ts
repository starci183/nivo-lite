import { defineCapabilityModule } from "@starci/nest-kit"
import type { WebhookProofsOptions } from "./webhook-proofs.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<WebhookProofsOptions>()
