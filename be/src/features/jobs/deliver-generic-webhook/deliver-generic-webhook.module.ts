import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./deliver-generic-webhook.module-definition"
import { DeliverStep } from "./steps/deliver.step"

@Module({ providers: [DeliverStep], exports: [DeliverStep] })
/** The application of the generic-webhook job: its step; the queue transport module imports it. */
export class DeliverGenericWebhookModule extends ConfigurableModuleClass {}
