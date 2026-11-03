import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ZaloWizardDraftsOptions } from "./zalo-wizard-drafts.options"

/** The configurable-module base of the zalo-wizard-drafts capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<ZaloWizardDraftsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ZaloWizardDraftsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ZaloWizardDraftsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
