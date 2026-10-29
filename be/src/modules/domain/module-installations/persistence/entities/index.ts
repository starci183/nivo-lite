import { ModuleInstallationEntity } from "./module-installation.entity"

export { ModuleInstallationEntity }

/** The entities of the module-installations capability, registered on the primary connection. */
export const moduleInstallationsEntities = [ModuleInstallationEntity] as const
