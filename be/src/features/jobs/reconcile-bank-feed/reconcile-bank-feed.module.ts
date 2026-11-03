import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./reconcile-bank-feed.module-definition"
import { ReconcileFeedStep } from "./steps/reconcile-feed.step"

@Module({ providers: [ReconcileFeedStep], exports: [ReconcileFeedStep] })
/** The application of the reconcile-bank-feed job: its step; the queue transport module imports it. */
export class ReconcileBankFeedModule extends ConfigurableModuleClass {}
