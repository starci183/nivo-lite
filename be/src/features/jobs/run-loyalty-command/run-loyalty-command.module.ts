import { Module } from "@nestjs/common"
import { RunStep } from "./steps/run.step"

@Module({ providers: [RunStep], exports: [RunStep] })
/** The application of the run-loyalty-command job: its step; the queue transport module imports it. */
export class RunLoyaltyCommandModule {}
