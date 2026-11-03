import { defineConfigurableModule } from "@starci/nest-kit"
import type { IssueInviteOptions } from "./issue-invite.options"

/** The configurable-module base of the issue-invite module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<IssueInviteOptions>()
