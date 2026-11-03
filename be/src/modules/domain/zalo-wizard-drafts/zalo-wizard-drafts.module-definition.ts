import { defineCapabilityModule } from "@starci/nest-kit"
import type { ZaloWizardDraftsOptions } from "./zalo-wizard-drafts.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ZaloWizardDraftsOptions>()
