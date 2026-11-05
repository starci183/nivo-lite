import type { EntityDefinition } from "./entity.types"

/** The ownership of an entity read without its field names: the field holding the workspace id. */
export interface AnyOwnership {
    /** The name of the field that holds the workspace id. */
    readonly workspace: string
}

/**
 * Any entity declaration, whatever its field map. `EntityDefinition<F>` is invariant in `F` (its key, version and ownership are
 * `keyof F`), so a function that reads a declaration of unknown fields takes this view, which every `EntityDefinition<F>` fits.
 */
export type AnyEntityDefinition = Omit<EntityDefinition, "key" | "version" | "ownership"> & {
    /** The name of the key field. */
    readonly key: string
    /** The name of the version token field. */
    readonly version: string
    /** The workspace ownership of the entity. */
    readonly ownership: AnyOwnership
}
