import { ModuleSetupSessionEntity } from "./module-setup-session.entity"

export { ModuleSetupSessionEntity }

/** The entities of the module-setup-sessions capability, registered on the primary connection. */
export const moduleSetupSessionsEntities: readonly [typeof ModuleSetupSessionEntity] = [
    ModuleSetupSessionEntity,
] as const
