import type { AccountDataTypeDef, AccountFieldDef, AccountFieldType } from "./account-data.contracts"
import { accountCheckNameOf, accountIndexNameOf } from "./account-data.policy"
import { AccountDataError, AccountDataErrorCode } from "./errors/account-data.error"

/** A type name: `<provider>.<name>`. */
const TYPE_NAME = /^[a-z0-9_]+\.[a-z0-9-]+$/

/** The longest type name: its partition (`account_data_` + name) stays within the 63 bytes postgres keeps, so no two names collide. */
const TYPE_NAME_MAX = 50

/** A provider as `connections.provider` names it. */
const PROVIDER_NAME = /^[a-z0-9_]+$/

/** A member name: a plain word (the entity engine's data key form). */
const MEMBER_NAME = /^[A-Za-z]\w{0,59}$/

/** An index name inside a type. */
const INDEX_NAME = /^[a-z][a-z0-9_]*$/

/** The field types a declaration may name. */
const FIELD_TYPES: ReadonlySet<AccountFieldType> = new Set([
    "text",
    "integer",
    "number",
    "boolean",
    "timestamp",
    "json",
])

/** The most indexes one type declares, and the most members one index names. */
const MAX_INDEXES = 4
const MAX_INDEX_FIELDS = 2

/** The longest retention a type declares, in days. */
const MAX_RETENTION_DAYS = 3650

/** True when the number is a whole number of at least 1. */
const isPositiveInteger = (value: number | undefined): boolean =>
    value !== undefined && Number.isSafeInteger(value) && value >= 1

/** The problems of one member. */
const fieldProblems = (name: string, field: AccountFieldDef): ReadonlyArray<string> => [
    ...(MEMBER_NAME.test(name) ? [] : [`field ${name}: the name is not a plain word`]),
    ...(FIELD_TYPES.has(field.type) ? [] : [`field ${name}: unknown type`]),
    ...(field.maxLength !== undefined && field.type !== "text" ? [`field ${name}: maxLength only on text`] : []),
    ...(field.maxLength !== undefined && !isPositiveInteger(field.maxLength)
        ? [`field ${name}: maxLength is not a whole number of at least 1`]
        : []),
]

/** The problems of a member a role (key, position, occurredAt) names: it exists, is required when asked, and has a fitting type. */
const roleProblems = (
    def: AccountDataTypeDef,
    role: string,
    name: string,
    types: ReadonlyArray<AccountFieldType>,
    required: boolean,
): ReadonlyArray<string> => {
    const field = def.fields[name]
    if (field === undefined) return [`${role} ${name}: no such field`]
    return [
        ...(types.includes(field.type) ? [] : [`${role} ${name}: must be ${types.join(" or ")}`]),
        ...(required && !field.required ? [`${role} ${name}: must be required`] : []),
    ]
}

/** The problems of the write mode and the members only some modes take. */
const modeProblems = (def: AccountDataTypeDef): ReadonlyArray<string> => [
    ...(def.write === "append" || def.write === "overwrite" || def.write === "advance" ? [] : ["write: unknown mode"]),
    ...(def.write === "advance" && def.position === undefined ? ["position: required by advance"] : []),
    ...(def.write !== "advance" && def.position !== undefined ? ["position: only with advance"] : []),
    ...(def.position === undefined
        ? []
        : roleProblems(def, "position", def.position, ["text", "integer", "number"], true)),
    ...(def.ttlMs !== undefined && def.write !== "overwrite" ? ["ttlMs: only with overwrite"] : []),
    ...(def.ttlMs !== undefined && !isPositiveInteger(def.ttlMs) ? ["ttlMs: not a whole number of at least 1"] : []),
    ...(def.wakes === true && def.write !== "append" ? ["wakes: only with append"] : []),
    ...(def.maxBytes !== undefined && !isPositiveInteger(def.maxBytes)
        ? ["maxBytes: not a whole number of at least 1"]
        : []),
]

/** The problems of the key and the occurredAt member. */
const keyProblems = (def: AccountDataTypeDef): ReadonlyArray<string> => [
    ...(def.key.length === 0 ? ["key: names no field"] : []),
    ...(new Set(def.key).size === def.key.length ? [] : ["key: names a field twice"]),
    ...def.key.flatMap((name) => roleProblems(def, "key", name, ["text", "integer"], true)),
    ...(def.occurredAt === undefined ? [] : roleProblems(def, "occurredAt", def.occurredAt, ["timestamp"], false)),
]

/** The problems of the declared indexes. */
const indexProblems = (def: AccountDataTypeDef): ReadonlyArray<string> => {
    const indexes = def.indexes ?? []
    const names = indexes.map((index) => accountIndexNameOf(def.name, index.name))
    return [
        ...(indexes.length > MAX_INDEXES ? [`indexes: more than ${MAX_INDEXES}`] : []),
        ...(new Set(names).size === names.length ? [] : ["indexes: two indexes share a name"]),
        ...indexes.flatMap((index) => [
            ...(INDEX_NAME.test(index.name) ? [] : [`index ${index.name}: the name is not lower-case snake`]),
            ...(index.on.length >= 1 && index.on.length <= MAX_INDEX_FIELDS
                ? []
                : [`index ${index.name}: names 1 to ${MAX_INDEX_FIELDS} fields`]),
            ...index.on.flatMap((name) =>
                roleProblems(
                    def,
                    `index ${index.name}`,
                    name,
                    ["text", "integer", "number", "boolean", "timestamp"],
                    false,
                ),
            ),
        ]),
    ]
}

/** The problems of the name, provider, version, fields, retention and secrets. */
const shapeProblems = (def: AccountDataTypeDef): ReadonlyArray<string> => {
    const fields = Object.entries(def.fields)
    const checks = fields.map(([name]) => accountCheckNameOf(def.name, name))
    const prefix = def.name.split(".", 1)[0]
    const retention = def.retention
    return [
        ...(TYPE_NAME.test(def.name) && def.name.length <= TYPE_NAME_MAX
            ? []
            : [`name: not <provider>.<name> of at most ${TYPE_NAME_MAX} characters`]),
        ...(def.provider !== null && !PROVIDER_NAME.test(def.provider) ? ["provider: not a provider name"] : []),
        ...(def.provider !== null && prefix !== def.provider ? ["name: the prefix is not the provider"] : []),
        ...(isPositiveInteger(def.version) ? [] : ["version: not a whole number of at least 1"]),
        ...(fields.length === 0 ? ["fields: none declared"] : []),
        ...(new Set(checks).size === checks.length ? [] : ["fields: two names give the same CHECK name"]),
        ...fields.flatMap(([name, field]) => fieldProblems(name, field)),
        ...(retention === "keep" ||
        (Number.isSafeInteger(retention.days) && retention.days >= 1 && retention.days <= MAX_RETENTION_DAYS)
            ? []
            : [`retention: keep, or 1 to ${MAX_RETENTION_DAYS} days`]),
        ...(def.secretFields ?? []).flatMap((name) => [
            ...(name === "" ? ["secretFields: an empty name"] : []),
            ...(def.fields[name] === undefined ? [] : [`secretFields: ${name} is a declared field`]),
        ]),
    ]
}

/** Every rule a declaration breaks of its own shape; empty when it is sound. */
export const typeProblemsOf = (def: AccountDataTypeDef): ReadonlyArray<string> => [
    ...shapeProblems(def),
    ...keyProblems(def),
    ...modeProblems(def),
    ...indexProblems(def),
]

/** Refuses a declaration that breaks a rule of its own shape, naming every rule it breaks. */
export const assertAccountDataType = (def: AccountDataTypeDef): void => {
    const problems = typeProblemsOf(def)
    if (problems.length === 0) return
    throw new AccountDataError({
        code: AccountDataErrorCode.TypeInvalid,
        params: { type: def.name, problems: problems.join("; ") },
    })
}

/**
 * Declares one account data type (the ONLY thing a provider adds). The declaration is checked against the rules of its own shape at
 * once (module load): name `<provider>.<name>` whose prefix is the provider (unless provider is null), key / occurredAt / position /
 * index members that exist with fitting types, at most 4 indexes of at most 2 members, `position` iff `advance`, `ttlMs` only with
 * `overwrite`, `wakes` only with `append`. Answers the declaration itself.
 */
export const defineAccountDataType = <T extends AccountDataTypeDef>(def: T): T => {
    assertAccountDataType(def)
    return def
}
