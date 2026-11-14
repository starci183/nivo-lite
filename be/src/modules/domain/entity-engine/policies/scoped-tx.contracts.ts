import type { EntityManager } from "typeorm"

declare const scopedBrand: unique symbol

/**
 * The agent a scope acts for. `id` is stamped on every record the scope inserts (the engine's own fact, never a value of the call);
 * `sees` says what the scope reads and writes: `own` only the records stamped with that agent (another agent's record answers as an
 * absent one, as another workspace's does), `all` every record of the workspace (a person acting for a module: the record is stamped
 * for the module's agent, the person's rights decide what they may touch).
 */
export interface AgentScope {
    /** The agent (`agents.id`) the records of the scope are stamped with. */
    readonly id: string
    /** `own`: only this agent's records are reached; `all`: every record of the workspace. */
    readonly sees: "own" | "all"
}

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
    /** The agent the scope acts for; absent for a scope no agent is behind (it stamps nothing and sees every record of the workspace). */
    readonly agent?: AgentScope
}

/** The parts of a scoped transaction before the brand is granted. */
export interface ScopedParts {
    /** The transaction's manager. */
    readonly manager: EntityManager
    /** The workspace the scope was entered for. */
    readonly workspaceId: string
    /** The agent the scope acts for, when one is behind it. */
    readonly agent?: AgentScope
}

/** The column a statement adds to its key to stay inside the scope's agent; absent for a scope that sees every record. */
export interface AgentKey {
    /** The agent whose records are the only ones the statement reaches. */
    readonly agentId?: string
}
