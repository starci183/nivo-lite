import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./process-public-api.module-definition"
import { ProcessPublicApiStep } from "./steps/process-public-api.step"

@Module({ providers: [ProcessPublicApiStep], exports: [ProcessPublicApiStep] })
/** Processes one public API request in the transaction that holds its worker fence. */
export class ProcessPublicApiJobModule extends ConfigurableModuleClass {}
