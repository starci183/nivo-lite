import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./run-zalo-wizard.module-definition"
import { WizardStep } from "./steps/wizard.step"

@Module({ providers: [WizardStep], exports: [WizardStep] })
/** The application of the run-zalo-wizard job: its step; the queue transport module imports it. */
export class RunZaloWizardModule extends ConfigurableModuleClass {}
