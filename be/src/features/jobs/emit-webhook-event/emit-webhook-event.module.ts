import { Module } from "@nestjs/common"
import { EmitWebhookEventStep } from "./steps/deliver.step"

@Module({ providers: [EmitWebhookEventStep], exports: [EmitWebhookEventStep] })
/** The application of the emit-webhook-event job: its step; the queue transport module imports it. */
export class EmitWebhookEventModule {}
