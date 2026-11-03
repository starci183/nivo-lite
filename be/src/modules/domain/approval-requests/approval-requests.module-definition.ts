import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ApprovalRequestsOptions } from "./approval-requests.options"

/** The configurable-module base of the approval-requests capability. */
const definition = new ConfigurableModuleBuilder<ApprovalRequestsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ApprovalRequestsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ApprovalRequestsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
