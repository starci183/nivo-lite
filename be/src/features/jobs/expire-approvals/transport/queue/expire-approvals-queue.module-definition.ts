import { defineConfigurableModule } from "@starci/nest-kit"
import type { ExpireApprovalsQueueOptions } from "./expire-approvals-queue.options"

/** The configurable-module base of the expire-approvals-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ExpireApprovalsQueueOptions>()
