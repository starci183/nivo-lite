import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DraftDossierRemedyQueueOptions } from "./draft-dossier-remedy-queue.options"

/** The configurable-module base of the draft-dossier-remedy-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DraftDossierRemedyQueueOptions>().setClassMethodName("register").build()
