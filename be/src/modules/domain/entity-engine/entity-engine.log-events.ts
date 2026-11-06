/** Log events of the entity engine runtime. */
export enum EntityEngineLogEvent {
    /** Row-level security refused a statement: a bug, logged at error level with a correlation id. */
    ScopeViolation = "entity-engine.scope_violation",
    /** A constraint violation no declaration lists: a gap in the entity declaration. */
    ConstraintUndeclared = "entity-engine.constraint_undeclared",
    /** A statement was refused as invalid by the database (a check, not-null, malformed value or foreign key): its SQLSTATE, entity, constraint and column. */
    QueryInvalid = "entity-engine.query_invalid",
    /** A statement failed in a way the engine does not know. */
    StatementFailed = "entity-engine.statement_failed",
}
