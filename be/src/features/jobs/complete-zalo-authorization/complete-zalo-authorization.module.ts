import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./complete-zalo-authorization.module-definition"
import { CompleteAuthorizationStep } from "./steps/complete-authorization.step"

@Module({ providers: [CompleteAuthorizationStep], exports: [CompleteAuthorizationStep] })
/** The application of the complete-zalo-authorization job: its step; the queue transport module imports it. */
export class CompleteZaloAuthorizationModule extends ConfigurableModuleClass {}
