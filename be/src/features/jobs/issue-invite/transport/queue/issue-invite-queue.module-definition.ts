import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { IssueInviteQueueOptions } from "./issue-invite-queue.options"

/** The configurable-module base of the issue-invite-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<IssueInviteQueueOptions>().setClassMethodName("register").build()
