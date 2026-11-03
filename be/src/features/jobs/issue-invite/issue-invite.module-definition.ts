import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { IssueInviteOptions } from "./issue-invite.options"

type Host = ConfigurableModuleHost<IssueInviteOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<IssueInviteOptions>().setClassMethodName("register").build()

/** The configurable-module base of the issue-invite module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the issue-invite module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the issue-invite module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
