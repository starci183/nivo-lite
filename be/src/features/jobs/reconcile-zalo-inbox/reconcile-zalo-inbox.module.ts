import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./reconcile-zalo-inbox.module-definition"
import { ReconcileInboxStep } from "./steps/reconcile-inbox.step"

@Module({ providers: [ReconcileInboxStep], exports: [ReconcileInboxStep] })
/** The application of the reconcile-zalo-inbox job: its step; the queue transport module imports it. */
export class ReconcileZaloInboxModule extends ConfigurableModuleClass {}
