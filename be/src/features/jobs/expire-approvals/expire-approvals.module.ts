import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./expire-approvals.module-definition"
import { ExpireApprovalsStep } from "./steps/expire-approvals.step"

@Module({ providers: [ExpireApprovalsStep], exports: [ExpireApprovalsStep] })
/** The application of the expire-approvals job: its step; the queue transport module imports it. */
export class ExpireApprovalsModule extends ConfigurableModuleClass {}
