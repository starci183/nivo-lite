import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ApprovalRequestsOptions } from "./approval-requests.options"

/** The configurable-module base of the approval-requests capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ApprovalRequestsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
