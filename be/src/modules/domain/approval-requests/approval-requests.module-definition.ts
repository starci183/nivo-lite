import { defineCapabilityModule } from "@starci/nest-kit"
import type { ApprovalRequestsOptions } from "./approval-requests.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ApprovalRequestsOptions>()
