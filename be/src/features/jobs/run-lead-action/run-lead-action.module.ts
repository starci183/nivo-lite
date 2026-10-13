import { Module } from "@nestjs/common"
import { RunLeadActionStep } from "./steps/run-lead-action.step"

@Module({ providers: [RunLeadActionStep], exports: [RunLeadActionStep] })
/** The application of the lead-action job and its single fenced step. */
export class RunLeadActionModule {}
