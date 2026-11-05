/** Log events of the entity engine runtime. */
export enum EntityEngineLogEvent {
    /** Row-level security refused a statement: a bug, logged at error level with a correlation id. */
    ScopeViolation = "entity-engine.scope_violation",
    /** A constraint violation no declaration lists: a gap in the entity declaration. */
    ConstraintUndeclared = "entity-engine.constraint_undeclared",
    /** A statement failed in a way the engine does not know. */
    StatementFailed = "entity-engine.statement_failed",
}
