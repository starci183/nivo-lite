import { defineConfigurableModule } from "@starci/nest-kit"
import type { IssueInviteQueueOptions } from "./issue-invite-queue.options"

/** The configurable-module base of the issue-invite-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<IssueInviteQueueOptions>()
