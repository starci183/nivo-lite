import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./reconcile-vectors.module-definition"
import { ReconcileRunStep } from "./steps/reconcile-run.step"

@Module({ providers: [ReconcileRunStep], exports: [ReconcileRunStep] })
/** The application of the reconcile-vectors job: its step; the queue transport module imports it. */
export class ReconcileVectorsModule extends ConfigurableModuleClass {}
