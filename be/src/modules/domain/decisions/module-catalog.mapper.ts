import type { ModuleDefinition } from "@modules/domain/modules"
import type { ActionEntry, ModuleEntry } from "./decisions.contracts"

/** The part of a module of the catalogue the engine reads: its audience, instancing, name and the commands it accepts. */
export const toModuleEntry = (module: ModuleDefinition): ModuleEntry => ({
    key: module.key,
    audience: module.audience,
    multiInstance: module.multiInstance,
    name: module.name,
    accepts: module.accepts.map((command) => ({
        command: command.command,
        action: command.action,
        subjectType: command.subjectType,
        requiredFields: command.requiredFields,
        description: command.description,
    })),
})

/** The part of an authority action of the catalogue the engine reads: its cap, the actions queued after it and its label. */
export const toActionEntry = (
    moduleKey: string,
    action: ModuleDefinition["authorityActions"][number],
): ActionEntry => ({
    action: action.action,
    moduleKey,
    maxMode: action.maxMode,
    next: action.next,
    label: action.label,
})
