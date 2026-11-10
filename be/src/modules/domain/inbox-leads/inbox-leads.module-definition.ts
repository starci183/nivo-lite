import { defineCapabilityModule } from "@starci/nest-kit"
import type { InboxLeadsOptions } from "./inbox-leads.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<InboxLeadsOptions>()
