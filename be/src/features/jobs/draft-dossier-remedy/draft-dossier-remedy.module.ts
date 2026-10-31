import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./draft-dossier-remedy.module-definition"
import { DraftDossierRemedyStep } from "./steps/draft-dossier-remedy.step"

@Module({ providers: [DraftDossierRemedyStep], exports: [DraftDossierRemedyStep] })
/** The application of the draft-dossier-remedy job: its step; the queue transport module imports it. */
export class DraftDossierRemedyModule extends ConfigurableModuleClass {}
