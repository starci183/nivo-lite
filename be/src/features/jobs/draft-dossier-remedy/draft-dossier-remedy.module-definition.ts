import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DraftDossierRemedyOptions } from "./draft-dossier-remedy.options"

/** The configurable-module base of the draft-dossier-remedy module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DraftDossierRemedyOptions>().setClassMethodName("register").build()
