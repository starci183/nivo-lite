import { fieldTextOrNullOf, isRecord } from "@modules/platform/primitives"
import { partitionNameOf, type EntityDefinition } from "@nivo-lite/agent-sdk/entity"

/** The longest identifier PostgreSQL keeps: the planner names a partition constraint `<partition>_<name>` cut to this. */
const IDENTIFIER_MAX = 63

/** A constraint of an entity's partition a violation may answer `taken` for. */
export interface DeclaredConstraint {
    /** The declared name. */
    readonly name: string
    /** The name PostgreSQL reports (`<partition>_<declared name>`, cut to 63 characters). */
    readonly pgName: string
    /** The refusal code the action sees. */
    readonly refusal: string
}

/** What a database failure means to the engine. */
export type PgFailure =
    /** A declared unique or no-overlap constraint was violated. */
    | { readonly kind: "taken"; readonly constraint: string; readonly refusal: string }
    /** A unique or exclusion constraint no declaration lists was violated. */
    | { readonly kind: "undeclared"; readonly constraint: string }
    /** A check, not-null, malformed value or foreign key refused the statement: its SQLSTATE and the constraint and column it names (never a value). */
    | {
          readonly kind: "invalid"
          readonly sqlstate: string
          readonly constraint: string | null
          readonly column: string | null
      }
    /** Row-level security refused the statement. */
    | { readonly kind: "scope" }
    /** A serialization failure, a deadlock or a lost connection. */
    | { readonly kind: "transient" }
    /** Anything else. */
    | { readonly kind: "unknown" }

/** The fields of a PostgreSQL error the engine reads: its SQLSTATE and the constraint and column it names. The message and the detail carry values and are never read. */
interface PgErrorFacts {
    readonly code: string
    readonly constraint: string | null
    readonly column: string | null
}

const UNIQUE_CODES: ReadonlySet<string> = new Set(["23505", "23P01"])
const INVALID_CODES: ReadonlySet<string> = new Set(["23514", "23502", "22P02", "23503"])
const TRANSIENT_CODES: ReadonlySet<string> = new Set([
    "40001",
    "40P01",
    "53300",
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EPIPE",
])
const SCOPE_CODE = "42501"

/** The declared constraints of an entity that answer `taken`: its unique constraints and no-overlap constraints. */
export const declaredConstraintsOf = (entity: EntityDefinition): ReadonlyArray<DeclaredConstraint> =>
    (entity.constraints ?? []).flatMap((declared) =>
        declared.kind === "check"
            ? []
            : [
                  {
                      name: declared.name,
                      pgName: `${partitionNameOf(entity.name)}_${declared.name}`.slice(0, IDENTIFIER_MAX),
                      refusal: declared.refusal,
                  },
              ],
    )

/** The code and constraint of a failure: on the error itself (typeorm copies the driver's fields) or on its `driverError`. */
const factsOf = (cause: unknown): PgErrorFacts | null => {
    if (!isRecord(cause)) return null
    const driver = isRecord(cause.driverError) ? cause.driverError : cause
    const code = fieldTextOrNullOf(driver.code) ?? fieldTextOrNullOf(cause.code)
    return code === null
        ? null
        : {
              code,
              constraint: fieldTextOrNullOf(driver.constraint) ?? fieldTextOrNullOf(cause.constraint),
              column: fieldTextOrNullOf(driver.column) ?? fieldTextOrNullOf(cause.column),
          }
}

const isConnectionClass = (code: string): boolean => code.startsWith("08") || code.startsWith("57P")

/**
 * What a failed statement means: a unique or exclusion violation is `taken` when its constraint is declared (with the declared refusal)
 * and `undeclared` otherwise; a check, not-null, malformed-value or foreign-key failure is `invalid`; 42501 (row-level security) is
 * `scope`; a serialization failure, a deadlock, too many connections or a lost connection is `transient`; anything else is `unknown`.
 * The facts are read through guards, never a cast.
 */
export const pgFailureOf = (cause: unknown, declared: ReadonlyArray<DeclaredConstraint>): PgFailure => {
    const facts = factsOf(cause)
    if (facts === null) return { kind: "unknown" }
    const { code, constraint, column } = facts
    if (UNIQUE_CODES.has(code)) {
        const found = declared.find((candidate) => candidate.pgName === constraint)
        return found === undefined
            ? { kind: "undeclared", constraint: constraint ?? "" }
            : { kind: "taken", constraint: found.name, refusal: found.refusal }
    }
    if (INVALID_CODES.has(code)) return { kind: "invalid", sqlstate: code, constraint, column }
    if (code === SCOPE_CODE) return { kind: "scope" }
    if (TRANSIENT_CODES.has(code) || isConnectionClass(code)) return { kind: "transient" }
    return { kind: "unknown" }
}
