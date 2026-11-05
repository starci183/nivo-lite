import type { ScopedParts, ScopedTx } from "./scoped-tx.contracts"

function assertScoped(_value: ScopedParts): asserts _value is ScopedTx {
    // The brand is compile-time only; `mintScopedTx` is the single caller.
}

/**
 * Brands a transaction manager and its workspace as scoped. Call it only after `engine_scope_enter(workspaceId)` ran on this
 * transaction's connection, and only from `EntityEngineService.scoped()`: it is the one place that vouches for the scope.
 */
export const mintScopedTx = (parts: ScopedParts): ScopedTx => {
    assertScoped(parts)
    return parts
}
