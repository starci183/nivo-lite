import { defineConfigurableModule } from "@starci/nest-kit"
import type { DraftDossierRemedyOptions } from "./draft-dossier-remedy.options"

/** The configurable-module base of the draft-dossier-remedy module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DraftDossierRemedyOptions>()
