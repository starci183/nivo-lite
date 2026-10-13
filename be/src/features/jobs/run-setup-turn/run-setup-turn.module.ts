import { Module } from "@nestjs/common"
import { RunSetupTurnStep } from "./steps/run-setup-turn.step"

@Module({ providers: [RunSetupTurnStep], exports: [RunSetupTurnStep] })
/** The application of the run-setup-turn job: its step; the queue transport module imports it. */
export class RunSetupTurnModule {}
