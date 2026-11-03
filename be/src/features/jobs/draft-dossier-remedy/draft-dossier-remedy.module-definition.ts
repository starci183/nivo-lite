import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { DraftDossierRemedyOptions } from "./draft-dossier-remedy.options"

type Host = ConfigurableModuleHost<DraftDossierRemedyOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<DraftDossierRemedyOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the draft-dossier-remedy module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the draft-dossier-remedy module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the draft-dossier-remedy module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
