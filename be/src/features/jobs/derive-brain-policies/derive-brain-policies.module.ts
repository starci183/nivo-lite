import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./derive-brain-policies.module-definition"
import { DerivePoliciesStep } from "./steps/derive-policies.step"

@Module({ providers: [DerivePoliciesStep], exports: [DerivePoliciesStep] })
/** The application of the derive-brain-policies job: its step; the queue transport module imports it. */
export class DeriveBrainPoliciesModule extends ConfigurableModuleClass {}
