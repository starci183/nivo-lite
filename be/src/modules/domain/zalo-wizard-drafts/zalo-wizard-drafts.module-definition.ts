import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ZaloWizardDraftsOptions } from "./zalo-wizard-drafts.options"

/** The configurable-module base of the zalo-wizard-drafts capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ZaloWizardDraftsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
