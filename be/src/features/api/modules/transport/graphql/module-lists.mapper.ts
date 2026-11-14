import type { InstallationView, OpenCatalog } from "@modules/domain/modules"
import type { ModuleInstallationType } from "./dto/module-installation.type"
import type { ModulesCatalogType } from "./dto/modules-catalog.type"
import { toModuleDefinitionType, toModuleInstallationType } from "./modules.mapper"

/** Maps the catalogue to the GraphQL type. */
export const toModulesCatalogType = (catalog: OpenCatalog): ModulesCatalogType => ({
    categories: catalog.categories,
    modules: catalog.modules.map((module) => toModuleDefinitionType(module)),
})

/** Maps the installed agents to the GraphQL type. */
export const toModuleInstallationsType = (records: ReadonlyArray<InstallationView>): Array<ModuleInstallationType> =>
    records.map((record) => toModuleInstallationType(record))
