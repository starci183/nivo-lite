import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"

/** What the app root tells the workbench door: what the installation registry holds. */
export interface WorkbenchDoorOptions {
    /** Every module declaration the app serves; the registry is built from them once, at boot. */
    readonly modules: ReadonlyArray<ModuleDeclaration>
    /** Every entity the modules declare; boot refuses a list read or an entity port that names none. */
    readonly entities: ReadonlyArray<EntityDefinition>
    /** The hash of the installed registry, which the front end compares with its own build. */
    readonly registryHash: string
}
