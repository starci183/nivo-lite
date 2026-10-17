import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./run-lead-gen.module-definition"
import { ContinueLeadGenStep } from "./steps/continue-lead-gen.step"

@Module({ providers: [ContinueLeadGenStep], exports: [ContinueLeadGenStep] })
/** The application of the lead generation job and its single fenced step. */
export class RunLeadGenModule extends ConfigurableModuleClass {}
