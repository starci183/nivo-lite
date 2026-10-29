import type { EntityManager } from "typeorm"
import { DatabaseError, DatabaseErrorCode } from "./errors/database.error"

declare const functionPartBrand: unique symbol
declare const parameterListBrand: unique symbol

/** The name of a database function, checked against the identifier shape of a migration. */
type DbFunctionPart = string & { readonly [functionPartBrand]: true }

/** The numbered placeholders `$1, $2, ...` of a call, built here from the argument count and never from a value. */
type DbParameterList = string & { readonly [parameterListBrand]: true }

/** The shape of a function name: a bare pg built-in or `schema.function`; which functions may be called is the dbFunctions list of hfs.json. */
const IDENTIFIER = /^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?$/

function assertFunctionPart(_value: string): asserts _value is DbFunctionPart {
    // The brand is compile-time only; `functionPart` is the single caller after checking the name.
}

function assertParameterList(_value: string): asserts _value is DbParameterList {
    // The brand is compile-time only; `parameterList` is the single caller.
}

const functionPart = (name: string): DbFunctionPart => {
    if (!IDENTIFIER.test(name)) throw new DatabaseError({ code: DatabaseErrorCode.FunctionRejected })
    assertFunctionPart(name)
    return name
}

const parameterList = (count: number): DbParameterList => {
    const placeholders = Array.from({ length: count }, (_, index) => `$${String(index + 1)}`).join(", ")
    assertParameterList(placeholders)
    return placeholders
}

/**
 * Calls one database function TypeORM cannot express (a pg built-in or a SECURITY DEFINER function of a migration) with numbered
 * parameters; the function name is an identifier the canon lint holds to the listed set, never a value.
 */
export const callDbFunction = async <T>(
    manager: EntityManager,
    name: string,
    args: ReadonlyArray<unknown>,
): Promise<ReadonlyArray<T>> => {
    const rows = await manager.query<Array<T>>(
        `SELECT * FROM ${functionPart(name)}(${parameterList(args.length)})`,
        [...args],
    )
    return rows
}

/** Takes a transaction-scoped advisory lock on the 64-bit hash of `key`; it is released when the manager's transaction ends. */
export const advisoryXactLock = async (manager: EntityManager, key: string): Promise<void> => {
    await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key])
}

/** Sends one NOTIFY on `channel` with `payload`, delivered when the manager's transaction commits. */
export const notify = async (manager: EntityManager, channel: string, payload: string): Promise<void> => {
    await manager.query("SELECT pg_notify($1, $2)", [channel, payload])
}
