import { ModuleContextVersionEntity } from "./module-context-version.entity"

export { ModuleContextVersionEntity }

/** The entities of the module-context-versions capability, registered on the primary connection. */
export const moduleContextVersionsEntities: readonly [typeof ModuleContextVersionEntity] = [
    ModuleContextVersionEntity,
] as const
