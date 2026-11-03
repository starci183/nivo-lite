import { ModuleSetupWriteEntity } from "./module-setup-write.entity"

export { ModuleSetupWriteEntity }

/** The entities of the module-setup-writes capability, registered on the primary connection. */
export const moduleSetupWritesEntities: readonly [typeof ModuleSetupWriteEntity] = [ModuleSetupWriteEntity] as const
