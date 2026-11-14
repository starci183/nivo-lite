import { templatesOf } from "@nivo-lite/agent-sdk/module"
import { INSTALLED } from "@modules/domain/installed-plugins"
import type { ModuleDefinition } from "./modules.contracts"

/**
 * The modules of the catalogue in display order: the template of every module the installed plugins declare (the core package and
 * each plugin package alike), ordered by `order`. Who may see and install each is the plugin's (`INSTALLED.isOpenTo`): this list is
 * every module that exists, never what one workspace is shown.
 */
export const MODULE_CATALOG: ReadonlyArray<ModuleDefinition> = templatesOf(INSTALLED.servers())

/** The module knowledge folders in catalogue order, shared by app composition. */
export const MODULE_KNOWLEDGE_FOLDERS: ReadonlyArray<string> = MODULE_CATALOG.map((module) => module.knowledgeFolder)
