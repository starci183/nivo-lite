import { Module } from "@nestjs/common"
import { DecisionsStep } from "./steps/decisions.step"

@Module({ providers: [DecisionsStep], exports: [DecisionsStep] })
/** The application of the decisions job: its step; the queue transport module imports it. */
export class RunDecisionsModule {}
