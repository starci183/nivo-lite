import { defineConfigurableModule } from "@starci/nest-kit"
import type { ExpireApprovalsOptions } from "./expire-approvals.options"

/** The configurable-module base of the expire-approvals module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ExpireApprovalsOptions>()
