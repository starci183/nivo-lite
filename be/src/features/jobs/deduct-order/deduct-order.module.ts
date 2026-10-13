import { Module } from "@nestjs/common"
import { DeductStep } from "./steps/deduct.step"

@Module({ providers: [DeductStep], exports: [DeductStep] })
/** The application of the deduct-order job: its step; the queue transport module imports it. */
export class DeductOrderModule {}
