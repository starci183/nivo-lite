import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ReviewDossiersQueueOptions } from "./review-dossiers-queue.options"

type Host = ConfigurableModuleHost<ReviewDossiersQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ReviewDossiersQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the review-dossiers-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the review-dossiers-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the review-dossiers-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
