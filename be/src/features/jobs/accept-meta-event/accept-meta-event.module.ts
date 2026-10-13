import { Module } from "@nestjs/common"
import { DeliverEventStep } from "./steps/deliver-event.step"

@Module({ providers: [DeliverEventStep], exports: [DeliverEventStep] })
/** The application of the accept-meta-event job: its step; the queue transport module imports it. */
export class AcceptMetaEventModule {}
