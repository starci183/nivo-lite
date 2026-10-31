import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./review-dossiers.module-definition"
import { ReviewDossiersStep } from "./steps/review-dossiers.step"

@Module({ providers: [ReviewDossiersStep], exports: [ReviewDossiersStep] })
/** The application of the review-dossiers job: its step; the queue transport module imports it. */
export class ReviewDossiersModule extends ConfigurableModuleClass {}
