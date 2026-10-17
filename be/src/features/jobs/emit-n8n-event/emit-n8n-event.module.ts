import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./emit-n8n-event.module-definition"
import { EmitN8nEventStep } from "./steps/deliver.step"

@Module({ providers: [EmitN8nEventStep], exports: [EmitN8nEventStep] })
/** The application of the emit-n8n-event job: its step; the queue transport module imports it. */
export class EmitN8nEventModule extends ConfigurableModuleClass {}
