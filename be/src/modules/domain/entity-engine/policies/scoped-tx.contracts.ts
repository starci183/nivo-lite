import type { EntityManager } from "typeorm"

declare const scopedBrand: unique symbol

/**
 * A transaction manager whose first statement was `public.engine_scope_enter(workspace)`: every compiler statement takes one, so a
 * statement cannot run outside the engine scope. Only `EntityEngineService.scoped()` mints it (through `mintScopedTx`).
 */
export interface ScopedTx {
    /** Proves the scope was entered; never read. */
    readonly [scopedBrand]: true
    /** The transaction's manager. */
    readonly manager: EntityManager
    /** The workspace the scope was entered for; the only workspace a statement names. */
    readonly workspaceId: string
}

/** The parts of a scoped transaction before the brand is granted. */
export interface ScopedParts {
    /** The transaction's manager. */
    readonly manager: EntityManager
    /** The workspace the scope was entered for. */
    readonly workspaceId: string
}
