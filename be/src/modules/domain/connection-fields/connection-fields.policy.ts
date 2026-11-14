import { cleanConnectionName, type ConnectionRecord } from "@modules/domain/connections"
import type {
    ConnectionActionDeclaration,
    ConnectionActionView,
    ConnectionFieldChange,
    ConnectionFieldDeclaration,
    ConnectionFieldInput,
    ConnectionFieldView,
    ConnectionFieldWriter,
    DeclarationProblem,
    FieldRefusal,
    ProviderFieldsDeclaration,
} from "./connection-fields.contracts"
import { ConnectionFieldsError, ConnectionFieldsErrorCode } from "./errors/connection-fields.error"

/** The value a meta flag holds when it is set. */
const FLAG_SET = "true"

/** The writer that serves a provider, with the provider's form; null when no writer declares the provider. */
export interface ServedForm {
    /** The writer. */
    readonly writer: ConnectionFieldWriter
    /** The provider's form. */
    readonly declaration: ProviderFieldsDeclaration
}

/** What the account holds beyond its record, read once by the caller when the form needs it. */
export interface AccountExtras {
    /** Whether the account has a sealed credential. */
    readonly storedSecret: boolean
    /** The address the provider delivers its webhooks to for this account, or null. */
    readonly webhookUrl: string | null
}

/** The writer and form of a provider among the registered writers, or null. */
export const servedFormOf = (writers: ReadonlyArray<ConnectionFieldWriter>, provider: string): ServedForm | null => {
    for (const writer of writers) {
        const declaration = writer.declarations.find((entry) => entry.provider === provider)
        if (declaration !== undefined) return { writer, declaration }
    }
    return null
}

/** The current public value of a field of the account; null for a secret or a fact the account does not hold. */
export const publicValueOf = (field: ConnectionFieldDeclaration, record: ConnectionRecord, webhookUrl: string | null): string | null => {
    if (field.kind === "secret") return null
    if (field.source.kind === "environment") return record.environment
    if (field.source.kind === "webhook-url") return webhookUrl
    if (field.source.kind === "meta") return record.meta[field.source.key] ?? null
    return null
}

/** True when one of the fields is known sealed only by the stored credential (the caller then asks the store, once). */
export const needsStoredSecret = (declaration: ProviderFieldsDeclaration): boolean =>
    declaration.fields.some((field) => field.kind === "secret" && field.sealedBy?.kind === "stored-secret")

/** True when one of the fields shows the account's webhook address (the caller then asks for it, once). */
export const needsWebhookUrl = (declaration: ProviderFieldsDeclaration): boolean =>
    declaration.fields.some((field) => field.source.kind === "webhook-url")

/** Whether a secret is sealed, as its declaration says to know it. */
const sealedOf = (field: ConnectionFieldDeclaration, record: ConnectionRecord, extras: AccountExtras): boolean | null => {
    if (field.kind !== "secret") return null
    return field.sealedBy?.kind === "meta-flag" ? record.meta[field.sealedBy.key] === FLAG_SET : extras.storedSecret
}

/** One field (or action input) as the form draws it. */
const fieldViewOf = (
    field: ConnectionFieldDeclaration,
    value: string | null,
    sealed: boolean | null,
    editable: boolean,
): ConnectionFieldView => ({
    key: field.key,
    label: field.label,
    kind: field.kind,
    required: field.required,
    minLength: field.minLength ?? null,
    maxLength: field.maxLength,
    choices: field.choices.map((choice) => ({ value: choice.value, label: choice.label, confirm: choice.confirm ?? null })),
    choiceSource: field.choiceSource ?? null,
    searchable: field.searchable === true,
    copyable: field.copyable === true,
    value,
    sealed,
    editable: editable && field.kind !== "identity",
    guidance: field.guidance ?? null,
})

/** The fields of the form with their public values; a secret answers only whether one is sealed. */
export const fieldViewsOf = (
    declaration: ProviderFieldsDeclaration,
    record: ConnectionRecord,
    extras: AccountExtras,
    canEdit: boolean,
): ReadonlyArray<ConnectionFieldView> =>
    declaration.fields.map((field) =>
        fieldViewOf(field, publicValueOf(field, record, extras.webhookUrl), sealedOf(field, record, extras), canEdit),
    )

/** Whether a list of roles holds a role (the lists are typed by the roles that may be named; the role asked about is any word). */
export const rolesInclude = (roles: ReadonlyArray<string>, role: string): boolean => roles.includes(role)

/** The declared actions of the form, each with whether the given role may run it. */
export const actionViewsOf = (declaration: ProviderFieldsDeclaration, role: string): ReadonlyArray<ConnectionActionView> =>
    (declaration.actions ?? []).map((action) => {
        const canRun = rolesInclude(action.runBy, role)
        return {
            key: action.key,
            label: action.label,
            canRun,
            inputs: action.inputs.map((input) => fieldViewOf(input, null, null, canRun)),
            results: action.results,
            guidance: action.guidance ?? null,
            confirm: action.confirm ?? null,
        }
    })

/** A refusal naming the field. */
const refused = (code: ConnectionFieldsErrorCode, key: string, reason?: string): ConnectionFieldsError =>
    new ConnectionFieldsError({ code, params: reason === undefined ? { key } : { key, reason } })

/** The value checked against the bounds and choices of its declaration. */
const boundedValueOf = (field: ConnectionFieldDeclaration, value: string): string => {
    if (field.minLength !== undefined && value.length < field.minLength) {
        throw refused(ConnectionFieldsErrorCode.FieldInvalid, field.key, "too_short")
    }
    if (field.maxLength !== null && value.length > field.maxLength) {
        throw refused(ConnectionFieldsErrorCode.FieldInvalid, field.key, "too_long")
    }
    if (field.kind === "choice" && !field.choices.some((choice) => choice.value === value)) {
        throw refused(ConnectionFieldsErrorCode.FieldInvalid, field.key, "not_a_choice")
    }
    return value
}

/** The new value of one field, checked against its declaration; null when it changes nothing. */
const checkedValueOf = (field: ConnectionFieldDeclaration, current: string | null, given: string): string | null => {
    const value = given.trim()
    if (field.kind === "identity") throw refused(ConnectionFieldsErrorCode.FieldReadOnly, field.key)
    // An empty secret keeps the sealed one.
    if (field.kind === "secret" && value === "") return null
    if (value === "" && field.required) throw refused(ConnectionFieldsErrorCode.FieldRequired, field.key)
    // A value sent back as it was shown changes nothing, even one the list no longer holds.
    if (field.kind !== "secret" && value === (current ?? "")) return null
    return boundedValueOf(field, value)
}

/** The new display name, or null when it is not given or unchanged; a blank or unusable one is refused. */
const checkedNameOf = (displayName: string | null | undefined, record: ConnectionRecord): string | null => {
    if (displayName === null || displayName === undefined) return null
    const name = cleanConnectionName(displayName)
    if (name === null) throw new ConnectionFieldsError({ code: ConnectionFieldsErrorCode.NameInvalid })
    return name === record.name ? null : name
}

/**
 * A person's change of one account, checked against the provider's form: every key must be declared and given once, an identity is
 * never changed, a required field is never emptied, a text stays within its bounds and a choice among its values. Only what changes is
 * kept: an unchanged value and an empty secret (keep the sealed one) are dropped.
 */
export const changeOf = (
    declaration: ProviderFieldsDeclaration,
    record: ConnectionRecord,
    displayName: string | null | undefined,
    inputs: ReadonlyArray<ConnectionFieldInput>,
): ConnectionFieldChange => {
    const values: Record<string, string> = {}
    const seen = new Set<string>()
    for (const input of inputs) {
        const field = declaration.fields.find((entry) => entry.key === input.key)
        if (field === undefined) throw refused(ConnectionFieldsErrorCode.FieldUnknown, input.key)
        if (seen.has(input.key)) throw refused(ConnectionFieldsErrorCode.FieldInvalid, input.key, "twice")
        seen.add(input.key)
        const value = checkedValueOf(field, publicValueOf(field, record, null), input.value)
        if (value !== null) values[input.key] = value
    }
    return { displayName: checkedNameOf(displayName, record), values }
}

/** The first refusal of the provider's own rules as the form's error; nothing when there is none. */
export const throwFirstRefusal = (refusals: ReadonlyArray<FieldRefusal>): void => {
    const [first] = refusals
    if (first !== undefined) throw refused(ConnectionFieldsErrorCode.FieldInvalid, first.key, first.reason)
}

/** The declared action of a form, or a refusal when the form declares none of that key. */
export const actionOf = (declaration: ProviderFieldsDeclaration, key: string): ConnectionActionDeclaration => {
    const action = (declaration.actions ?? []).find((entry) => entry.key === key)
    if (action === undefined) throw new ConnectionFieldsError({ code: ConnectionFieldsErrorCode.ActionUnknown, params: { action: key } })
    return action
}

/** The inputs of an action run, checked against its declaration: every key declared and given once, every required one given. */
export const actionInputsOf = (
    action: ConnectionActionDeclaration,
    inputs: ReadonlyArray<ConnectionFieldInput>,
): Readonly<Record<string, string>> => {
    const values: Record<string, string> = {}
    for (const input of inputs) {
        const field = action.inputs.find((entry) => entry.key === input.key)
        if (field === undefined) throw refused(ConnectionFieldsErrorCode.FieldUnknown, input.key)
        if (input.key in values) throw refused(ConnectionFieldsErrorCode.FieldInvalid, input.key, "twice")
        const value = checkedValueOf(field, null, input.value)
        if (value !== null) values[input.key] = value
    }
    const missing = action.inputs.find((field) => field.required && !(field.key in values))
    if (missing !== undefined) throw refused(ConnectionFieldsErrorCode.FieldRequired, missing.key)
    return values
}

/**
 * What makes a provider's form unfit to register because it could put a secret on a page: a `secret` field with a readable source,
 * or an action result named like a secret field of the form or a secret input of the action. Empty for a fit form.
 */
export const declarationProblems = (declaration: ProviderFieldsDeclaration): ReadonlyArray<DeclarationProblem> => {
    const secretKeys = new Set(declaration.fields.filter((field) => field.kind === "secret").map((field) => field.key))
    const readable = declaration.fields
        .filter((field) => field.kind === "secret" && field.source.kind !== "none")
        .map((field): DeclarationProblem => ({ provider: declaration.provider, code: "secret_source_readable", key: field.key }))
    const results = (declaration.actions ?? []).flatMap((action) => {
        const secretInputs = new Set(action.inputs.filter((input) => input.kind === "secret").map((input) => input.key))
        return action.results
            .filter((member) => secretKeys.has(member.key) || secretInputs.has(member.key))
            .map((member): DeclarationProblem => ({
                provider: declaration.provider,
                code: "action_result_secret",
                key: `${action.key}.${member.key}`,
            }))
    })
    return [...readable, ...results]
}

/** Every problem of every form the writers declare (the registration check). */
export const writersProblems = (writers: ReadonlyArray<ConnectionFieldWriter>): ReadonlyArray<DeclarationProblem> =>
    writers.flatMap((writer) => writer.declarations.flatMap((declaration) => declarationProblems(declaration)))

/** The problem codes of every provider whose form has problems, by provider: the providers the form is disabled for. */
export const disabledProvidersOf = (
    writers: ReadonlyArray<ConnectionFieldWriter>,
): ReadonlyMap<string, ReadonlyArray<DeclarationProblem["code"]>> => {
    const disabled = new Map<string, ReadonlyArray<DeclarationProblem["code"]>>()
    for (const problem of writersProblems(writers)) {
        const codes = disabled.get(problem.provider) ?? []
        if (!codes.includes(problem.code)) disabled.set(problem.provider, [...codes, problem.code])
    }
    return disabled
}

/** The keys of the secret fields of a form and of an action's secret inputs: what an action answer may never carry. */
export const secretKeysOf = (declaration: ProviderFieldsDeclaration, action: ConnectionActionDeclaration): ReadonlySet<string> =>
    new Set([
        ...declaration.fields.filter((field) => field.kind === "secret").map((field) => field.key),
        ...action.inputs.filter((input) => input.kind === "secret").map((input) => input.key),
    ])

/** True when the change changes nothing. */
export const isEmptyChange = (change: ConnectionFieldChange): boolean =>
    change.displayName === null && Object.keys(change.values).length === 0
