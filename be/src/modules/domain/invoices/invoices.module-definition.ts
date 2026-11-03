import { defineCapabilityModule } from "@starci/nest-kit"
import type { InvoicesOptions } from "./invoices.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<InvoicesOptions>()
