import { Module } from "@nestjs/common"
import { HoldForOwnerCheckStep } from "./steps/hold-for-owner-check.step"

@Module({ providers: [HoldForOwnerCheckStep], exports: [HoldForOwnerCheckStep] })
/** The application of the reconcile-bank-credit job: its step; the queue transport module imports it. */
export class ReconcileBankCreditModule {}
