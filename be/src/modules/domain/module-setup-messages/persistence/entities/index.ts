import { ModuleSetupMessageEntity } from "./module-setup-message.entity"

export { ModuleSetupMessageEntity }

/** The entities of the module-setup-messages capability, registered on the primary connection. */
export const moduleSetupMessagesEntities: readonly [typeof ModuleSetupMessageEntity] = [
    ModuleSetupMessageEntity,
] as const
