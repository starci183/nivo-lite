import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./refresh-zalo-tokens.module-definition"
import { RenewTokensStep } from "./steps/renew-tokens.step"

@Module({ providers: [RenewTokensStep], exports: [RenewTokensStep] })
/** The application of the refresh-zalo-tokens job: its step; the queue transport module imports it. */
export class RefreshZaloTokensModule extends ConfigurableModuleClass {}
