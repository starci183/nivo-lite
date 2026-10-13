import { Module } from "@nestjs/common"
import { PlaceOrderStep } from "./steps/place-order.step"

@Module({ providers: [PlaceOrderStep], exports: [PlaceOrderStep] })
/** The application of the create-payment-order job: its step; the queue transport module imports it. */
export class CreatePaymentOrderModule {}
