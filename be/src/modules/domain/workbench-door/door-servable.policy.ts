import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { registryOf } from "./door-registry.policy"
import { WorkbenchDoorError, WorkbenchDoorErrorCode } from "./errors/workbench-door.error"

/** The refusals that mean the door cannot serve a module yet: a port nothing provides, or an entity nobody declared. */
const UNSERVABLE: ReadonlySet<WorkbenchDoorErrorCode> = new Set([
    WorkbenchDoorErrorCode.RegistryPortUnknown,
    WorkbenchDoorErrorCode.RegistryEntityMissing,
])

/**
 * The modules the door can serve now: those whose reads and actions use only ports the door provides, on entities that are declared.
 * A module that still lists a port of its own (a store the engine does not provide yet) is left out, so its workbench answers
 * "unknown" and the rest of the app boots; any other registry fault (a duplicate or malformed id, an outside call in a transaction)
 * is a wiring bug and still stops the start.
 */
export const servableModulesOf = (
    modules: ReadonlyArray<ModuleDeclaration>,
    entities: ReadonlyArray<EntityDefinition>,
): ReadonlyArray<ModuleDeclaration> =>
    modules.filter((module) => {
        try {
            registryOf([module], entities)
            return true
        } catch (cause) {
            if (cause instanceof WorkbenchDoorError && UNSERVABLE.has(cause.code)) return false
            throw cause
        }
    })
