import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./issue-invite.module-definition"
import { IssueInviteStep } from "./steps/issue-invite.step"

@Module({ providers: [IssueInviteStep], exports: [IssueInviteStep] })
/** The application of the issue-invite job: its step; the queue transport module imports it. */
export class IssueInviteModule extends ConfigurableModuleClass {}
