import type { ModuleDefinition, ModulesCatalog } from "@modules/domain/modules"
import type { GetCatalogRequest } from "../../application/get-catalog.contracts"
import type { GetModuleRequest } from "../../application/get-module.contracts"
import type { ModuleDefinitionType } from "./dto/module-definition.type"
import type { ModuleKeyInput } from "./dto/module-key.input"
import type { ModulesCatalogType } from "./dto/modules-catalog.type"

/** The catalogue request: it takes no input. */
export const toCatalogRequest = (): GetCatalogRequest => ({})

/** Maps the key of the GraphQL input to the query request. */
export const toGetModuleRequest = (input: ModuleKeyInput): GetModuleRequest => ({ ...input })

/** Maps one module definition to the GraphQL type. */
export const toModuleDefinitionType = (module: ModuleDefinition): ModuleDefinitionType => ({ ...module })

/** Maps the catalogue to the GraphQL type. */
export const toModulesCatalogType = (catalog: ModulesCatalog): ModulesCatalogType => ({ ...catalog })
