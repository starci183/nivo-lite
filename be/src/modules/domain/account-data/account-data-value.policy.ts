import { isRecord } from "@modules/platform/primitives"
import type {
    AccountDataTypeDef,
    AccountFieldDef,
    AccountOwner,
    AccountRowValues,
    AccountValue,
    CheckedRow,
} from "./account-data.contracts"
import { accountExternalIdOf } from "./account-data.policy"
import {
    ACCOUNT_BOOLEAN,
    ACCOUNT_INTEGER,
    ACCOUNT_JSON,
    ACCOUNT_NUMBER,
    ACCOUNT_TEXT,
    ACCOUNT_TIMESTAMP,
    ACCOUNT_VALUE,
    type AccountMemberSchema,
    type AccountValueSchema,
} from "./account-data-value.schema"
import { AccountDataError, AccountDataErrorCode } from "./errors/account-data.error"

/** The schema of one member, required or optional. */
const memberSchemaOf = (field: AccountFieldDef): AccountMemberSchema => {
    const typed = ((): AccountMemberSchema => {
        switch (field.type) {
            case "text":
                return field.maxLength === undefined ? ACCOUNT_TEXT : ACCOUNT_TEXT.max(field.maxLength)
            case "integer":
                return ACCOUNT_INTEGER
            case "number":
                return ACCOUNT_NUMBER
            case "boolean":
                return ACCOUNT_BOOLEAN
            case "timestamp":
                return ACCOUNT_TIMESTAMP
            case "json":
                return ACCOUNT_JSON
        }
    })()
    return field.required ? typed : typed.optional()
}

/** The schemas built so far, one per declaration. */
const SCHEMAS = new WeakMap<AccountDataTypeDef, AccountValueSchema>()

/**
 * The schema of a type's values, built from its fields: exactly the declared members (strict), each of its declared type. One rule for
 * absence: an optional member is absent, never null; no member is ever null (a `json` member holds any JSON but null at its top). A
 * text member without `maxLength` is held to 1 MiB characters. The generated CHECKs of the partition are the second layer.
 */
export const schemaOf = (def: AccountDataTypeDef): AccountValueSchema => {
    const known = SCHEMAS.get(def)
    if (known !== undefined) return known
    const shape: Record<string, AccountMemberSchema> = Object.fromEntries(
        Object.entries(def.fields).map(([name, field]) => [name, memberSchemaOf(field)]),
    )
    const built: AccountValueSchema = ACCOUNT_VALUE.extend(shape)
    SCHEMAS.set(def, built)
    return built
}

/** The value as the type's schema reads it, or a VALUE_INVALID naming the members at fault (never their content). */
export const parsedValueOf = (def: AccountDataTypeDef, value: object): Record<string, unknown> => {
    const parsed = schemaOf(def).safeParse(value)
    if (parsed.success) return parsed.data
    const members = [...new Set(parsed.error.issues.map((issue) => issue.path.map(String).join(".") || "(value)"))]
    throw new AccountDataError({
        code: AccountDataErrorCode.ValueInvalid,
        params: { type: def.name, members: members.join(", ") },
    })
}

/** One part of a key: a text as it is, an integer in decimal; anything else is no key. */
const keyPartOf = (member: unknown): string | null => {
    if (typeof member === "string") return member === "" ? null : member
    return typeof member === "number" && Number.isSafeInteger(member) ? String(member) : null
}

/**
 * The row key of a value: the declared key members' values joined by ":" (each a non-empty text or an integer), hashed to
 * `sha256:<hex>` when longer than 400 characters. A member that is no key part is a VALUE_INVALID.
 */
export const accountKeyOf = (def: AccountDataTypeDef, value: AccountValue): string => {
    const parts = def.key.map((name) => {
        const part = keyPartOf(value[name])
        if (part === null) {
            throw new AccountDataError({
                code: AccountDataErrorCode.ValueInvalid,
                params: { type: def.name, members: name },
            })
        }
        return part
    })
    return accountExternalIdOf(parts.join(":"))
}

/** The first member, at any depth (objects inside arrays included), whose NAME is one of `names`; null when there is none. */
export const secretMemberOf = (value: unknown, names: ReadonlyArray<string>): string | null => {
    if (names.length === 0) return null
    const named = new Set(names)
    const pending: Array<unknown> = [value]
    while (pending.length > 0) {
        const next = pending.pop()
        if (Array.isArray(next)) {
            const items: ReadonlyArray<unknown> = next
            pending.push(...items)
        } else if (isRecord(next)) {
            const found = Object.keys(next).find((name) => named.has(name))
            if (found !== undefined) return found
            pending.push(...Object.values(next))
        }
    }
    return null
}

/** The size of a value's JSON text, in bytes. */
export const valueBytesOf = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), "utf8")

/** When a value says it happened (its declared `occurredAt` member), or undefined: the database clock then. */
export const occurredAtOf = (def: AccountDataTypeDef, value: AccountValue): Date | undefined => {
    if (def.occurredAt === undefined) return undefined
    const member = value[def.occurredAt]
    return typeof member === "string" ? new Date(member) : undefined
}

/** The position member of an `advance` value: a text or a number (the schema already holds it to its type). */
export const positionOf = (def: AccountDataTypeDef, value: AccountValue): string | number => {
    const member = def.position === undefined ? undefined : value[def.position]
    if (typeof member === "string" || typeof member === "number") return member
    throw new AccountDataError({
        code: AccountDataErrorCode.ValueInvalid,
        params: { type: def.name, members: def.position ?? "(position)" },
    })
}

/** True when `next` is strictly after `stored`: texts by code unit, numbers numerically; a mix of the two never is. */
export const isForward = (next: string | number, stored: string | number): boolean => {
    if (typeof next === "number" && typeof stored === "number") return next > stored
    if (typeof next === "string" && typeof stored === "string") return next > stored
    return false
}

/**
 * A value checked against a declaration already resolved, with its key and time: it must fit the declared fields (VALUE_INVALID), hold
 * no secret member at any depth (SECRET_IN_VALUE) and stay within the declared size (VALUE_TOO_LARGE).
 */
export const checkedRowOf = (def: AccountDataTypeDef, input: object): CheckedRow => {
    const value = parsedValueOf(def, input)
    const forbidden = secretMemberOf(value, def.secretFields ?? [])
    if (forbidden !== null) {
        throw new AccountDataError({
            code: AccountDataErrorCode.SecretInValue,
            params: { type: def.name, member: forbidden },
        })
    }
    if (def.maxBytes !== undefined && valueBytesOf(value) > def.maxBytes) {
        throw new AccountDataError({
            code: AccountDataErrorCode.ValueTooLarge,
            params: { type: def.name, maxBytes: def.maxBytes },
        })
    }
    return { def, value, key: accountKeyOf(def, value), occurredAt: occurredAtOf(def, value) }
}

/** The columns of a new row of the account. */
export const rowValuesOf = (owner: AccountOwner, row: CheckedRow): AccountRowValues => ({
    type: row.def.name,
    typeVersion: row.def.version,
    provider: owner.provider,
    connectionId: owner.connectionId,
    workspaceId: owner.workspaceId,
    key: row.key,
    value: row.value,
    ...(row.occurredAt === undefined ? {} : { occurredAt: row.occurredAt }),
})
