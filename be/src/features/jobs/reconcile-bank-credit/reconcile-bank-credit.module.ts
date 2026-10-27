import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./reconcile-bank-credit.module-definition"
import { SettleBankCreditStep } from "./steps/settle-bank-credit.step"

@Module({ providers: [SettleBankCreditStep], exports: [SettleBankCreditStep] })
/** The application of the reconcile-bank-credit job: its step; the queue transport module imports it. */
export class ReconcileBankCreditModule extends ConfigurableModuleClass {}
