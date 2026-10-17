import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./emit-webhook-event.module-definition"
import { EmitWebhookEventStep } from "./steps/deliver.step"

@Module({ providers: [EmitWebhookEventStep], exports: [EmitWebhookEventStep] })
/** The application of the emit-webhook-event job: its step; the queue transport module imports it. */
export class EmitWebhookEventModule extends ConfigurableModuleClass {}
